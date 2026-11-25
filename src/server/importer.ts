import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { batches, leadSources, leadTypes, leads, learners, pipelineStages, programs, roles, users } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { mapHeaders, type ColKey } from "@/lib/csv-schema";
import { computeFinalFee, type DiscountType } from "@/lib/fees";
import { keysFor, splitList } from "@/lib/phone";
import { emailProblem, LIMITS, listProblem, phoneProblem, tooLong } from "@/lib/validate";
import { parseYear } from "@/lib/year";
import { ensureCollege, fillBlankDetails, findExistingLearner } from "./learner-service";
import { logSystemActivity } from "./leads";
import { learnerScope } from "./scope";

export type ImportOptions = {
  learnersOnly: boolean;
  defaultSourceId: number | null;
  /** "me", "round_robin", or a user id as text */
  assign: string;
  /** "Same for every row": when set, replaces the file's own column. */
  all: { college?: string; branch?: string; year?: number | null };
};

export type ImportResult = {
  rows: number;
  learnersCreated: number;
  learnersUpdated: number;
  leadsCreated: number;
  leadsUpdated: number;
  failed: { row: number; reason: string }[];
  unknownColumns: string[];
};

const lc = (s: string) => s.trim().toLowerCase();
const num = (s: string) => {
  const n = Number(s.replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) && s.trim() !== "" ? n : null;
};

export async function importSpreadsheet(session: Session, grid: string[][], opts: ImportOptions): Promise<ImportResult> {
  const headers = grid[0]!;
  const map = mapHeaders(headers);
  const result: ImportResult = { rows: 0, learnersCreated: 0, learnersUpdated: 0, leadsCreated: 0, leadsUpdated: 0, failed: [], unknownColumns: headers.filter((_, i) => map[i] === null && headers[i]) };

  if (!map.includes("name")) throw new Error("No “Learner Name” column found. The first row must be the column titles.");
  if (!map.includes("phone") && !map.includes("email")) throw new Error("No “Phone” or “Email” column found.");

  // Reference data, loaded once.
  const [sources, types, stages, people, progs, bats] = await Promise.all([
    db.select().from(leadSources),
    db.select().from(leadTypes).orderBy(asc(leadTypes.id)),
    db.select().from(pipelineStages).orderBy(asc(pipelineStages.sortOrder)),
    db.select({ id: users.id, name: users.name, email: users.email, scope: roles.viewScope }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).where(eq(users.active, true)),
    db.select().from(programs),
    db.select().from(batches),
  ]);
  const byName = <T extends { name: string }>(list: T[], v: string) => list.find((x) => lc(x.name) === lc(v));
  const firstOpen = stages.find((s) => s.kind === "open");
  if (!firstOpen) throw new Error("No pipeline status is set up.");
  const counsellors = people.filter((p) => p.scope === "own");
  const pool = counsellors.length ? counsellors : people.filter((p) => p.id === session.user.id);
  let turn = 0;
  const ownerFor = (): number => {
    if (session.user.viewScope === "own" || opts.assign === "me") return session.user.id;
    if (opts.assign === "round_robin") return pool[turn++ % pool.length]!.id;
    const id = Number(opts.assign);
    return people.some((p) => p.id === id) ? id : session.user.id;
  };

  const collegeCache = new Map<string, number | null>();
  const college = async (name: string) => {
    const k = lc(name);
    if (!collegeCache.has(k)) collegeCache.set(k, await ensureCollege(name));
    return collegeCache.get(k) ?? null;
  };

  const scope = learnerScope(session);

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]!;
    const v: Partial<Record<ColKey, string>> = {};
    map.forEach((key, i) => {
      if (key) v[key] = (row[i] ?? "").trim();
    });
    if (Object.values(v).every((x) => !x)) continue;
    result.rows++;
    const line = r + 1;

    try {
      const name = v.name ?? "";
      const phones = splitList(v.phone ?? "");
      const emails = splitList(v.email ?? "");
      if (!name) throw new Error("Missing learner name.");
      if (phones.length === 0 && emails.length === 0) throw new Error("Needs a phone number or an email.");
      const bad =
        tooLong(name, LIMITS.name, "The name") ?? listProblem(phones, phoneProblem) ?? listProblem(emails, emailProblem) ??
        tooLong(opts.all.college || v.college, LIMITS.short, "The college") ?? tooLong(opts.all.branch || v.branch, LIMITS.short, "The branch") ??
        tooLong(v.city, LIMITS.short, "The city") ?? tooLong(v.qualification, LIMITS.short, "The degree / course") ?? tooLong(v.title, LIMITS.short, "The title");
      if (bad) throw new Error(bad);

      const collegeName = opts.all.college || v.college || "";
      const branch = opts.all.branch || v.branch || null;
      const year = opts.all.year ?? parseYear(v.year);
      const collegeId = collegeName ? await college(collegeName) : null;

      // ---------- check the enquiry's details first, so a bad row creates nothing
      const wantsEnquiry = !opts.learnersOnly;
      const program = wantsEnquiry && v.program ? byName(progs, v.program) : undefined;
      if (wantsEnquiry && v.program && !program) throw new Error(`Unknown program “${v.program}”.`);
      const batch = wantsEnquiry && v.batch ? bats.find((b) => lc(b.name) === lc(v.batch!) && (!program || b.programId === program.id)) : undefined;
      if (wantsEnquiry && v.batch && !batch) throw new Error(`Unknown batch “${v.batch}”.`);
      const programId = batch?.programId ?? program?.id ?? null;

      const stage = wantsEnquiry && v.stage ? byName(stages, v.stage) : firstOpen;
      if (wantsEnquiry && !stage) throw new Error(`Unknown stage “${v.stage}”.`);
      const source = wantsEnquiry && v.source ? byName(sources, v.source) : undefined;
      if (wantsEnquiry && v.source && !source) throw new Error(`Unknown source “${v.source}”.`);
      const type = wantsEnquiry && v.type ? byName(types, v.type) : types[0];
      if (wantsEnquiry && v.type && !type) throw new Error(`Unknown lead type “${v.type}”.`);

      // Who looks after this row: taken once, so "share equally" moves on by exactly one person per row.
      const assigned = ownerFor();
      let ownerId = assigned;
      if (wantsEnquiry && v.counsellor && session.user.viewScope === "all") {
        const p = people.find((x) => lc(x.name) === lc(v.counsellor!) || lc(x.email) === lc(v.counsellor!));
        if (!p) throw new Error(`Unknown counsellor “${v.counsellor}”.`);
        ownerId = p.id;
      }

      // ---------- the learner
      let learnerId = await findExistingLearner(phones, emails, scope);
      if (learnerId) {
        const [before] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
        await fillBlankDetails(learnerId, { collegeId, branch, year, city: v.city || null, qualification: v.qualification || null });
        const [after] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
        if (JSON.stringify(before) !== JSON.stringify(after)) result.learnersUpdated++;
      } else {
        const [created] = await db
          .insert(learners)
          .values({ name, phones, emails, ...keysFor(phones, emails), collegeId, branch, year, city: v.city || null, qualification: v.qualification || null, ownerId: assigned })
          .returning({ id: learners.id });
        learnerId = created!.id;
        result.learnersCreated++;
      }
      if (opts.learnersOnly) continue;

      const courseFee = batch ? Number(batch.fee) : num(v.course_fee ?? "");
      const dtRaw = lc(v.discount_type ?? "");
      const discountType: DiscountType | null = dtRaw.startsWith("p") || dtRaw === "%" ? "percent" : dtRaw.startsWith("f") || dtRaw === "₹" ? "fixed" : null;
      const discountValue = num(v.discount_value ?? "");
      const useDiscount = discountType && discountValue && discountValue > 0;
      const finalFee = computeFinalFee(courseFee, useDiscount ? discountType : null, useDiscount ? discountValue : null);
      const closeDate = v.expected_close_date && !Number.isNaN(Date.parse(v.expected_close_date)) ? v.expected_close_date.slice(0, 10) : null;
      const programName = progs.find((p) => p.id === programId)?.name ?? null;
      const title = v.title || (batch ? `${programName} · ${batch.name}` : (programName ?? `${name} - Enquiry`));

      const values = {
        stageId: stage!.id, sourceId: source?.id ?? opts.defaultSourceId, typeId: type?.id ?? null, programId, batchId: batch?.id ?? null, title,
        courseFee: courseFee === null ? null : courseFee.toFixed(2), discountType: useDiscount ? discountType : null,
        discountValue: useDiscount ? discountValue!.toFixed(2) : null, finalFee: finalFee === null ? null : finalFee.toFixed(2),
        expectedCloseDate: closeDate, remarks: v.remarks || null, ownerId,
        closedAt: stage!.kind === "open" ? null : new Date(),
      };

      const leadId = Number(v.lead_id);
      if (v.lead_id && Number.isInteger(leadId)) {
        const [existing] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, leadId), session.user.viewScope === "own" ? eq(leads.ownerId, session.user.id) : undefined)).limit(1);
        if (!existing) throw new Error(`Enquiry #${leadId} was not found.`);
        await db.update(leads).set({ ...values, updatedAt: new Date() }).where(eq(leads.id, leadId));
        result.leadsUpdated++;
      } else {
        const [created] = await db.insert(leads).values({ ...values, learnerId }).returning({ id: leads.id });
        await logSystemActivity(created!.id, session.user.id, "Enquiry imported");
        result.leadsCreated++;
      }
    } catch (e) {
      result.failed.push({ row: line, reason: e instanceof Error ? e.message : "Could not import this row." });
    }
  }
  return result;
}
