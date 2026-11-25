import "server-only";
import { and, asc, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { colleges, leads, learners, pipelineStages, users } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { learnerScope } from "./scope";

export type LearnerFilters = { q?: string; collegeId?: number; year?: number; ownerId?: number; enrolment?: "enrolled" | "not"; from?: string; to?: string; sort?: LearnerSort };
export const LEARNER_SORTS = ["newest", "oldest", "name_asc", "name_desc"] as const;
export type LearnerSort = (typeof LEARNER_SORTS)[number];
const stageCount = (kind: "open" | "won" | "lost") =>
  sql<number>`(select count(*)::int from ${leads} join ${pipelineStages} on ${pipelineStages.id} = ${leads.stageId} where ${leads.learnerId} = ${learners.id} and ${pipelineStages.kind} = ${kind})`;
const hasEnrolment = sql`exists (select 1 from ${leads} join ${pipelineStages} on ${pipelineStages.id} = ${leads.stageId} where ${leads.learnerId} = ${learners.id} and ${pipelineStages.kind} = 'won')`;
/** Learners whose every enquiry is finished (enrolled or lost) sink to the bottom of the list. */
const closed = sql`not exists (select 1 from ${leads} join ${pipelineStages} on ${pipelineStages.id} = ${leads.stageId} where ${leads.learnerId} = ${learners.id} and ${pipelineStages.kind} = 'open') and exists (select 1 from ${leads} where ${leads.learnerId} = ${learners.id})`;
const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");

function conditions(session: Session, f: LearnerFilters): (SQL | undefined)[] {
  const c: (SQL | undefined)[] = [learnerScope(session)];
  if (f.collegeId) c.push(eq(learners.collegeId, f.collegeId));
  if (f.year) c.push(eq(learners.year, f.year));
  if (f.ownerId) c.push(eq(learners.ownerId, f.ownerId));
  if (f.from) c.push(gte(learners.createdAt, sql`${f.from}::date`));
  if (f.to) c.push(lt(learners.createdAt, sql`(${f.to}::date + 1)`));
  if (f.enrolment === "enrolled") c.push(hasEnrolment);
  if (f.enrolment === "not") c.push(sql`not ${hasEnrolment}`);
  const q = f.q?.trim();
  if (q) {
    const like = `%${esc(q)}%`;
    const digits = q.replace(/\D/g, "");
    c.push(
      or(
        ilike(learners.name, like),
        ilike(colleges.name, like),
        ilike(learners.branch, like),
        ilike(learners.city, like),
        sql`array_to_string(${learners.emailKeys}, ',') ilike ${like}`,
        digits.length >= 3 ? sql`exists (select 1 from unnest(${learners.phoneKeys}) k where k like ${"%" + digits + "%"})` : undefined,
      ),
    );
  }
  return c;
}

const select = {
  id: learners.id,
  name: learners.name,
  phones: learners.phones,
  emails: learners.emails,
  branch: learners.branch,
  year: learners.year,
  city: learners.city,
  qualification: learners.qualification,
  kind: learners.kind,
  collegeId: learners.collegeId,
  college: colleges.name,
  ownerId: learners.ownerId,
  owner: users.name,
  createdAt: learners.createdAt,
  enquiries: sql<number>`(select count(*)::int from ${leads} where ${leads.learnerId} = ${learners.id})`,
  enrolled: stageCount("won"),
  openEnquiries: stageCount("open"),
  lostEnquiries: stageCount("lost"),
};

function base() {
  return db.select(select).from(learners).leftJoin(colleges, eq(colleges.id, learners.collegeId)).leftJoin(users, eq(users.id, learners.ownerId));
}
export type LearnerRow = Awaited<ReturnType<typeof base>>[number];

function learnerOrder(sort?: LearnerSort) {
  switch (sort) {
    case "oldest": return [asc(learners.createdAt), asc(learners.id)];
    case "name_asc": return [asc(learners.name), asc(learners.id)];
    case "name_desc": return [desc(learners.name), desc(learners.id)];
    // Default: newest first, with learners whose enquiries are all finished (enrolled / lost) at the end.
    default: return [sql`(${closed})`, desc(learners.createdAt), desc(learners.id)];
  }
}

export async function listLearners(session: Session, f: LearnerFilters, page: number, pageSize: number) {
  const where = and(...conditions(session, f));
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    base().where(where).orderBy(...learnerOrder(f.sort)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(learners).leftJoin(colleges, eq(colleges.id, learners.collegeId)).where(where),
  ]);
  return { rows, total };
}

export async function allLearners(session: Session, f: LearnerFilters) {
  return base().where(and(...conditions(session, f))).orderBy(asc(learners.id));
}

export async function getLearner(session: Session, id: number) {
  const [row] = await base().where(and(eq(learners.id, id), learnerScope(session))).limit(1);
  return row ?? null;
}

export async function getLearnerLeads(learnerId: number) {
  return db
    .select({ id: leads.id, title: leads.title, createdAt: leads.createdAt, finalFee: leads.finalFee, courseFee: leads.courseFee, stage: pipelineStages.name, kind: pipelineStages.kind })
    .from(leads)
    .innerJoin(pipelineStages, eq(pipelineStages.id, leads.stageId))
    .where(eq(leads.learnerId, learnerId))
    .orderBy(desc(leads.createdAt));
}

export async function listColleges(q?: string) {
  const like = q?.trim() ? `%${esc(q.trim())}%` : undefined;
  return db
    .select({
      id: colleges.id,
      name: colleges.name,
      city: colleges.city,
      website: colleges.website,
      learners: sql<number>`(select count(*)::int from ${learners} where ${learners.collegeId} = ${colleges.id})`,
    })
    .from(colleges)
    .where(like ? or(ilike(colleges.name, like), ilike(colleges.city, like)) : undefined)
    .orderBy(asc(colleges.name));
}
