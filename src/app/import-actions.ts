"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import type { ImportState } from "@/lib/import-state";
import { normalizeHeader } from "@/lib/csv-schema";
import { optionalInt, str } from "@/lib/utils";
import { emailProblem, LIMITS, phoneProblem, tooLong } from "@/lib/validate";
import { parseYear } from "@/lib/year";
import { importSpreadsheet } from "@/server/importer";
import { readSpreadsheet } from "@/server/spreadsheet";
import { ensureCollege } from "@/server/learner-service";
import { db } from "@/db";
import { connections } from "@/db/schema";

function fileFrom(form: FormData): File | string {
  const f = form.get("file");
  if (f instanceof File && f.size > 0) return f;
  if (f instanceof File && f.name) return "That file is empty. Add the column titles and at least one row, then try again.";
  return "Choose a .csv or .xlsx file to import.";
}

/** Imports learners (and, unless "learners only", their enquiries) from a spreadsheet. */
export async function importAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const session = await requireSession();
  if (!session.can("leads.import")) return { error: "You don't have permission to import." };
  const file = fileFrom(form);
  if (typeof file === "string") return { error: file };

  const learnersOnly = form.get("learners_only") === "1";
  const yearRaw = str(form, "all_year");
  if (yearRaw && parseYear(yearRaw) === null) return { error: "That year isn't valid. Choose 1st to 6th year." };

  try {
    const grid = await readSpreadsheet(file);
    const result = await importSpreadsheet(session, grid, {
      learnersOnly,
      defaultSourceId: optionalInt(form, "default_source_id"),
      assign: str(form, "assign") || "me",
      all: { college: str(form, "all_college") || undefined, branch: str(form, "all_branch") || undefined, year: yearRaw ? parseYear(yearRaw) : undefined },
    });
    revalidatePath("/leads");
    revalidatePath("/learners");
    revalidatePath("/colleges");
    revalidatePath("/dashboard");
    return { result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The import failed." };
  }
}

const CONNECTION_COLS: Record<string, "name" | "designation" | "phone" | "email" | "institution" | "notes"> = {
  name: "name", fullname: "name", contactname: "name", designation: "designation", role: "designation", position: "designation",
  phone: "phone", mobile: "phone", mobileno: "phone", phonenumber: "phone", email: "email", emailid: "email",
  schoolcollege: "institution", college: "institution", school: "institution", institution: "institution", institute: "institution", notes: "notes", note: "notes", remarks: "notes",
};

export async function importConnectionsAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const session = await requireSession();
  if (!session.can("connections.manage")) return { error: "You don't have permission to import connections." };
  const file = fileFrom(form);
  if (typeof file === "string") return { error: file };

  try {
    const grid = await readSpreadsheet(file);
    const cols = grid[0]!.map((h) => CONNECTION_COLS[normalizeHeader(h)] ?? null);
    if (!cols.includes("name")) return { error: "No “Name” column found. The first row must be the column titles." };

    const out = { created: 0, failed: [] as { row: number; reason: string }[] };
    for (let r = 1; r < grid.length; r++) {
      const v: Partial<Record<(typeof cols)[number] & string, string>> = {};
      cols.forEach((k, i) => k && (v[k] = (grid[r]![i] ?? "").trim()));
      if (Object.values(v).every((x) => !x)) continue;
      try {
        if (!v.name) throw new Error("Missing name.");
        if (!v.phone && !v.email) throw new Error("Needs a phone number or an email.");
        const bad = tooLong(v.name, LIMITS.name, "The name") ?? (v.phone ? phoneProblem(v.phone) : null) ?? (v.email ? emailProblem(v.email) : null)
          ?? tooLong(v.designation, LIMITS.short, "The designation") ?? tooLong(v.institution, LIMITS.short, "The institution") ?? tooLong(v.notes, LIMITS.long, "The notes");
        if (bad) throw new Error(bad);
        await db.insert(connections).values({ name: v.name, designation: v.designation || null, phone: v.phone || null, email: v.email || null, collegeId: await ensureCollege(v.institution), notes: v.notes || null, ownerId: session.user.id });
        out.created++;
      } catch (e) {
        out.failed.push({ row: r + 1, reason: e instanceof Error ? e.message : "Could not import this row." });
      }
    }
    revalidatePath("/connections");
    return { connections: out };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "The import failed." };
  }
}
