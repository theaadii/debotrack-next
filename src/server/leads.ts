import "server-only";
import { and, asc, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { activities, batches, colleges, leadSources, leadTypes, leads, learners, pipelineStages, programs, users } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { leadScope } from "./scope";

export type LeadFilters = {
  q?: string;
  stageId?: number;
  sourceId?: number;
  ownerId?: number;
  programId?: number;
  from?: string; // yyyy-mm-dd
  to?: string;
};

const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export function leadConditions(session: Session, f: LeadFilters): (SQL | undefined)[] {
  const c: (SQL | undefined)[] = [leadScope(session)];
  if (f.stageId) c.push(eq(leads.stageId, f.stageId));
  if (f.sourceId) c.push(eq(leads.sourceId, f.sourceId));
  if (f.ownerId) c.push(eq(leads.ownerId, f.ownerId));
  if (f.programId) c.push(eq(leads.programId, f.programId));
  if (f.from) c.push(gte(leads.createdAt, sql`${f.from}::date`));
  if (f.to) c.push(lt(leads.createdAt, sql`(${f.to}::date + 1)`));
  const q = f.q?.trim();
  if (q) {
    const like = `%${esc(q)}%`;
    const digits = q.replace(/\D/g, "");
    c.push(
      or(
        ilike(learners.name, like),
        ilike(leads.title, like),
        ilike(colleges.name, like),
        sql`array_to_string(${learners.emailKeys}, ',') ilike ${like}`,
        digits.length >= 3 ? sql`exists (select 1 from unnest(${learners.phoneKeys}) k where k like ${"%" + digits + "%"})` : undefined,
      ),
    );
  }
  return c;
}

const owner = alias(users, "owner");

export const leadRowSelect = {
  id: leads.id,
  title: leads.title,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  courseFee: leads.courseFee,
  discountType: leads.discountType,
  discountValue: leads.discountValue,
  finalFee: leads.finalFee,
  expectedCloseDate: leads.expectedCloseDate,
  remarks: leads.remarks,
  lostReason: leads.lostReason,
  closedAt: leads.closedAt,
  learnerId: learners.id,
  learner: learners.name,
  phones: learners.phones,
  emails: learners.emails,
  branch: learners.branch,
  year: learners.year,
  city: learners.city,
  qualification: learners.qualification,
  college: colleges.name,
  stageId: pipelineStages.id,
  stage: pipelineStages.name,
  stageKind: pipelineStages.kind,
  source: leadSources.name,
  type: leadTypes.name,
  program: programs.name,
  batch: batches.name,
  ownerId: owner.id,
  owner: owner.name,
};

function joined() {
  return db
    .select(leadRowSelect)
    .from(leads)
    .innerJoin(learners, eq(learners.id, leads.learnerId))
    .innerJoin(pipelineStages, eq(pipelineStages.id, leads.stageId))
    .leftJoin(colleges, eq(colleges.id, learners.collegeId))
    .leftJoin(leadSources, eq(leadSources.id, leads.sourceId))
    .leftJoin(leadTypes, eq(leadTypes.id, leads.typeId))
    .leftJoin(programs, eq(programs.id, leads.programId))
    .leftJoin(batches, eq(batches.id, leads.batchId))
    .leftJoin(owner, eq(owner.id, leads.ownerId));
}

export type LeadRow = Awaited<ReturnType<typeof joined>>[number];

export async function listLeads(session: Session, f: LeadFilters, page: number, pageSize: number) {
  const where = and(...leadConditions(session, f));
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    joined().where(where).orderBy(desc(leads.createdAt), desc(leads.id)).limit(pageSize).offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(leads)
      .innerJoin(learners, eq(learners.id, leads.learnerId))
      .leftJoin(colleges, eq(colleges.id, learners.collegeId))
      .where(where),
  ]);
  return { rows, total };
}

/** Every matching enquiry (for export). */
export async function allLeads(session: Session, f: LeadFilters) {
  return joined()
    .where(and(...leadConditions(session, f)))
    .orderBy(asc(leads.id));
}

export async function getLead(session: Session, id: number) {
  const [row] = await joined().where(and(eq(leads.id, id), leadScope(session))).limit(1);
  return row ?? null;
}

export async function getLeadActivities(leadId: number) {
  return db
    .select({
      id: activities.id,
      type: activities.type,
      title: activities.title,
      comment: activities.comment,
      startsAt: activities.startsAt,
      done: activities.done,
      createdAt: activities.createdAt,
      user: users.name,
    })
    .from(activities)
    .leftJoin(users, eq(users.id, activities.userId))
    .where(eq(activities.leadId, leadId))
    .orderBy(desc(activities.createdAt), desc(activities.id));
}

export async function logSystemActivity(leadId: number, userId: number | null, title: string, comment?: string) {
  await db.insert(activities).values({ leadId, userId, type: "system", title, comment: comment ?? null, done: true });
}
