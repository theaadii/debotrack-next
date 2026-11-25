import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { colleges, connections } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { COLUMNS, LEARNER_TEMPLATE_KEYS, TEMPLATE_KEYS, type ColKey } from "@/lib/csv-schema";
import { allLeads, type LeadFilters } from "./leads";
import { allLearners, type LearnerFilters } from "./learners";
import { toCsv, toXlsx } from "./spreadsheet";

type Cell = string | number | null;
const date = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const stamp = (d: Date | null) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }).replace(",", "") : "");
const label = (key: ColKey) => COLUMNS.find((c) => c.key === key)!.label;

export type Built = { headers: string[]; rows: Cell[][] };

export async function buildLeadsExport(session: Session, filters: LeadFilters): Promise<Built> {
  const rows = await allLeads(session, filters);
  const keys = COLUMNS.map((c) => c.key);
  return {
    headers: keys.map(label),
    rows: rows.map((r) => {
      const by: Record<ColKey, Cell> = {
        lead_id: r.id, name: r.learner, phone: r.phones.join(", "), email: r.emails.join(", "), college: r.college ?? "", branch: r.branch ?? "",
        year: r.year ? `${r.year}${r.year === 1 ? "st" : r.year === 2 ? "nd" : r.year === 3 ? "rd" : "th"} Year` : "", title: r.title, source: r.source ?? "", type: r.type ?? "",
        stage: r.stage, counsellor: r.owner ?? "", course_fee: r.courseFee === null ? "" : Number(r.courseFee), expected_close_date: date(r.expectedCloseDate),
        program: r.program ?? "", batch: r.batch ?? "", city: r.city ?? "", qualification: r.qualification ?? "",
        discount_type: r.discountType === "percent" ? "Percent" : r.discountType === "fixed" ? "Fixed" : "",
        discount_value: r.discountValue === null ? "" : Number(r.discountValue), final_fee: r.finalFee === null ? "" : Number(r.finalFee),
        remarks: r.remarks ?? "", lost_reason: r.lostReason ?? "", created_at: stamp(r.createdAt), closed_at: stamp(r.closedAt),
      };
      return keys.map((k) => by[k]);
    }),
  };
}

export async function buildLearnersExport(session: Session, filters: LearnerFilters): Promise<Built> {
  const rows = await allLearners(session, filters);
  return {
    headers: ["Learner Name", "Phone", "Email", "School / College / Company", "Branch / Stream", "Year of Study", "City", "Qualification", "Type", "Counsellor", "Enquiries", "Added On"],
    rows: rows.map((r) => [r.name, r.phones.join(", "), r.emails.join(", "), r.college ?? "", r.branch ?? "", r.year ?? "", r.city ?? "", r.qualification ?? "", r.kind === "professional" ? "Working professional" : "Student", r.owner ?? "", r.enquiries, date(r.createdAt)]),
  };
}

export async function buildConnectionsExport(): Promise<Built> {
  const rows = await db
    .select({ name: connections.name, designation: connections.designation, phone: connections.phone, email: connections.email, institution: colleges.name, notes: connections.notes })
    .from(connections)
    .leftJoin(colleges, eq(colleges.id, connections.collegeId))
    .orderBy(asc(colleges.name), asc(connections.name));
  return { headers: ["Name", "Designation", "Phone", "Email", "School / College", "Notes"], rows: rows.map((r) => [r.name, r.designation ?? "", r.phone ?? "", r.email ?? "", r.institution ?? "", r.notes ?? ""]) };
}

export function buildTemplate(kind: "leads" | "learners" | "connections"): Built {
  if (kind === "connections") return { headers: ["Name", "Designation", "Phone", "Email", "School / College", "Notes"], rows: [["Dr. A. Sharma", "HOD", "98765 43210", "sharma@college.edu", "Sample Engineering College", "Met at the campus drive"]] };
  const keys = kind === "learners" ? LEARNER_TEMPLATE_KEYS : TEMPLATE_KEYS;
  const sample: Partial<Record<ColKey, Cell>> = { name: "Asha Verma", phone: "98765 43210", email: "asha@example.com", college: "Sample Engineering College", branch: "CSE", year: "3rd Year", city: "Pune", qualification: "B.E. (pursuing)", source: "Web", remarks: "Interested in the weekend batch" };
  return { headers: keys.map(label), rows: [keys.map((k) => sample[k] ?? "")] };
}

export async function fileResponse(built: Built, format: string, baseName: string): Promise<Response> {
  const day = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    return new Response(toCsv(built.headers, built.rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${baseName}-${day}.csv"`, "Cache-Control": "no-store" },
    });
  }
  const buf = await toXlsx(baseName, built.headers, built.rows);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${baseName}-${day}.xlsx"`, "Cache-Control": "no-store" },
  });
}
