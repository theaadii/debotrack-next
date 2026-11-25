import "server-only";
import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { colleges, learners } from "@/db/schema";
import { keysFor } from "@/lib/phone";

/** A college by name (case-insensitive); created when it does not exist yet. */
export async function ensureCollege(name: string | null | undefined): Promise<number | null> {
  const clean = name?.trim();
  if (!clean) return null;
  const find = () =>
    db.select({ id: colleges.id }).from(colleges).where(sql`lower(${colleges.name}) = lower(${clean})`).limit(1);

  const [existing] = await find();
  if (existing) return existing.id;
  await db.insert(colleges).values({ name: clean }).onConflictDoNothing();
  const [created] = await find();
  return created?.id ?? null;
}

/** An existing learner with the same phone (last 10 digits) or email; undefined scope = everyone. */
export async function findExistingLearner(phones: string[], emails: string[], scope?: SQL, exceptId?: number): Promise<number | null> {
  const { phoneKeys, emailKeys } = keysFor(phones, emails);
  if (phoneKeys.length === 0 && emailKeys.length === 0) return null;

  const textArray = (keys: string[]) => sql`ARRAY[${sql.join(keys.map((k) => sql`${k}`), sql`, `)}]::text[]`;
  const parts: SQL[] = [];
  if (phoneKeys.length) parts.push(sql`${learners.phoneKeys} && ${textArray(phoneKeys)}`);
  if (emailKeys.length) parts.push(sql`${learners.emailKeys} && ${textArray(emailKeys)}`);

  const [row] = await db
    .select({ id: learners.id })
    .from(learners)
    .where(and(sql`(${sql.join(parts, sql` or `)})`, scope, exceptId ? ne(learners.id, exceptId) : undefined))
    .orderBy(learners.id)
    .limit(1);
  return row?.id ?? null;
}

/** Fills Year / Branch / College on an existing learner only where they are still blank. */
export async function fillBlankDetails(
  learnerId: number,
  details: { collegeId?: number | null; branch?: string | null; year?: number | null; city?: string | null; qualification?: string | null },
) {
  const [cur] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
  if (!cur) return;
  const patch: Partial<typeof learners.$inferInsert> = {};
  if (!cur.collegeId && details.collegeId) patch.collegeId = details.collegeId;
  if (!cur.branch && details.branch) patch.branch = details.branch;
  if (!cur.year && details.year) patch.year = details.year;
  if (!cur.city && details.city) patch.city = details.city;
  if (!cur.qualification && details.qualification) patch.qualification = details.qualification;
  if (Object.keys(patch).length) await db.update(learners).set({ ...patch, updatedAt: new Date() }).where(eq(learners.id, learnerId));
}
