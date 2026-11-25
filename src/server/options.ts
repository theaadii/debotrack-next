import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { batches, colleges, leadSources, leadTypes, pipelineStages, programs, roles, users } from "@/db/schema";

/** Everything the enquiry forms and filters need to offer as choices. Cached for the request. */
export const getOptions = cache(async () => {
  const [stages, sources, types, programRows, batchRows, collegeRows, people] = await Promise.all([
    db.select().from(pipelineStages).orderBy(asc(pipelineStages.sortOrder)),
    db.select().from(leadSources).orderBy(asc(leadSources.name)),
    db.select().from(leadTypes).orderBy(asc(leadTypes.id)),
    db.select().from(programs).where(eq(programs.active, true)).orderBy(asc(programs.name)),
    db.select().from(batches).where(eq(batches.active, true)).orderBy(asc(batches.startDate), asc(batches.name)),
    db.select({ id: colleges.id, name: colleges.name }).from(colleges).orderBy(asc(colleges.name)),
    db
      .select({ id: users.id, name: users.name, role: roles.name })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(eq(users.active, true))
      .orderBy(asc(users.name)),
  ]);

  return {
    stages,
    sources,
    types,
    programs: programRows.map((p) => ({
      id: p.id,
      name: p.name,
      batches: batchRows
        .filter((b) => b.programId === p.id)
        .map((b) => ({ id: b.id, name: b.name, fee: Number(b.fee), startDate: b.startDate })),
    })),
    colleges: collegeRows,
    counsellors: people,
  };
});

export type Options = Awaited<ReturnType<typeof getOptions>>;
