import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Session } from "@/lib/auth";
import { TZ } from "./scope";

const n = (v: unknown) => Number(v ?? 0);
/** Runs raw SQL and returns just the rows. */
const run = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;

export async function getDashboard(session: Session, days: number) {
  const own = session.user.viewScope === "own";
  const uid = session.user.id;
  const ownLead = own ? sql`and l.owner_id = ${uid}` : sql``;
  const since = sql`now() - make_interval(days => ${days})`;
  const today = sql`(now() at time zone ${TZ})::date`;

  const [summary] = await run(sql`
    select
      count(*) filter (where l.created_at >= ${since}) as new_enq,
      count(*) filter (where l.created_at >= ${since} and s.kind = 'won') as converted,
      count(*) filter (where s.kind = 'won' and l.closed_at >= ${since}) as enrolled,
      coalesce(sum(coalesce(l.final_fee, l.course_fee)) filter (where s.kind = 'won' and l.closed_at >= ${since}), 0) as fees,
      count(*) filter (where s.kind = 'open') as open_enq,
      count(*) filter (where s.kind = 'open' and l.updated_at < now() - interval '14 days') as cold
    from app.leads l join app.pipeline_stages s on s.id = l.stage_id
    where true ${ownLead}`);

  const ownAct = own ? sql`and (le.owner_id = ${uid} or a.user_id = ${uid})` : sql``;
  const followUps = await run(sql`
    select a.id, a.type, a.title, a.starts_at, le.id as lead_id, p.name as learner
    from app.activities a
    left join app.leads le on le.id = a.lead_id
    left join app.learners p on p.id = coalesce(a.learner_id, le.learner_id)
    where a.type in ('call','meeting','task') and a.done = false and a.starts_at is not null
      and (a.starts_at at time zone ${TZ})::date = ${today} ${ownAct}
    order by a.starts_at limit 8`);

  const [overdue] = await run(sql`
    select count(*) as c from app.activities a left join app.leads le on le.id = a.lead_id
    where a.type in ('call','meeting','task') and a.done = false and a.starts_at is not null
      and a.starts_at < now() and (a.starts_at at time zone ${TZ})::date < ${today} ${ownAct}`);

  const stages = await run(sql`
    select s.id, s.name, count(l.id) as n
    from app.pipeline_stages s
    left join app.leads l on l.stage_id = s.id ${own ? sql`and l.owner_id = ${uid}` : sql``}
    where s.kind = 'open' group by s.id, s.name, s.sort_order order by s.sort_order`);

  const series = await run(sql`
    select to_char(d::date, 'DD Mon') as day,
      (select count(*) from app.leads l where (l.created_at at time zone ${TZ})::date = d::date ${ownLead}) as enquiries,
      (select count(*) from app.leads l join app.pipeline_stages s on s.id = l.stage_id
        where s.kind = 'won' and (l.closed_at at time zone ${TZ})::date = d::date ${ownLead}) as enrolled
    from generate_series(${today} - (${days - 1}::int), ${today}, interval '1 day') d order by d`);

  const latest = await run(sql`
    select l.id, p.name as learner, l.title, s.name as stage, s.kind, l.created_at
    from app.leads l join app.learners p on p.id = l.learner_id join app.pipeline_stages s on s.id = l.stage_id
    where true ${ownLead} order by l.created_at desc limit 6`);

  const bySource = await run(sql`
    select coalesce(src.name, 'No source') as name, count(*) as enquiries,
      count(*) filter (where s.kind = 'won') as enrolled
    from app.leads l join app.pipeline_stages s on s.id = l.stage_id left join app.lead_sources src on src.id = l.source_id
    where l.created_at >= ${since} ${ownLead} group by 1 order by 2 desc limit 8`);

  const byProgram = await run(sql`
    select coalesce(p.name, 'No program') as name, count(*) as enquiries,
      count(*) filter (where s.kind = 'won') as enrolled
    from app.leads l join app.pipeline_stages s on s.id = l.stage_id left join app.programs p on p.id = l.program_id
    where l.created_at >= ${since} ${ownLead} group by 1 order by 2 desc limit 8`);

  const upcomingBatches = await run(sql`
    select b.id, p.name as program, b.name, b.start_date, b.seats,
      (select count(*) from app.leads l where l.batch_id = b.id) as enquiries,
      (select count(*) from app.leads l join app.pipeline_stages s on s.id = l.stage_id where l.batch_id = b.id and s.kind = 'won') as enrolled
    from app.batches b join app.programs p on p.id = b.program_id
    where b.active and (b.start_date is null or b.start_date >= (${today} - 45))
    order by b.start_date nulls last, b.name limit 6`);

  const counsellors = own ? [] : await run(sql`
    select u.name,
      count(l.id) filter (where l.created_at >= ${since}) as enquiries,
      count(l.id) filter (where s.kind = 'won' and l.closed_at >= ${since}) as enrolled,
      coalesce(sum(coalesce(l.final_fee, l.course_fee)) filter (where s.kind = 'won' and l.closed_at >= ${since}), 0) as fees
    from app.users u join app.roles r on r.id = u.role_id
    left join app.leads l on l.owner_id = u.id left join app.pipeline_stages s on s.id = l.stage_id
    where u.active group by u.id, u.name order by 2 desc, u.name limit 8`);

  const newEnq = n(summary?.new_enq);
  return {
    newEnq,
    enrolled: n(summary?.enrolled),
    conversion: newEnq > 0 ? Math.round((n(summary?.converted) / newEnq) * 100) : null,
    fees: n(summary?.fees),
    openEnq: n(summary?.open_enq),
    cold: n(summary?.cold),
    overdue: n(overdue?.c),
    followUps: followUps.map((r) => ({
      id: n(r.id), type: String(r.type), title: String(r.title), startsAt: new Date(r.starts_at as string),
      leadId: r.lead_id ? n(r.lead_id) : null, learner: (r.learner as string | null) ?? null,
    })),
    bySource: bySource.map((r) => ({ name: String(r.name), enquiries: n(r.enquiries), enrolled: n(r.enrolled) })),
    byProgram: byProgram.map((r) => ({ name: String(r.name), enquiries: n(r.enquiries), enrolled: n(r.enrolled) })),
    upcomingBatches: upcomingBatches.map((r) => ({
      id: n(r.id), program: String(r.program), name: String(r.name), startDate: (r.start_date as string | null) ?? null,
      seats: r.seats === null ? null : n(r.seats), enquiries: n(r.enquiries), enrolled: n(r.enrolled),
    })),
    counsellors: counsellors.map((r) => ({ name: String(r.name), enquiries: n(r.enquiries), enrolled: n(r.enrolled), fees: n(r.fees) })),
    stages: stages.map((r) => ({ id: n(r.id), name: String(r.name), count: n(r.n) })),
    series: series.map((r) => ({ day: String(r.day), enquiries: n(r.enquiries), enrolled: n(r.enrolled) })),
    latest: latest.map((r) => ({
      id: n(r.id), learner: String(r.learner), title: String(r.title), stage: String(r.stage), kind: String(r.kind) as "open" | "won" | "lost",
      createdAt: new Date(r.created_at as string),
    })),
  };
}
