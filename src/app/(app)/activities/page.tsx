import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, leads, learners, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Badge, Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatDateTime, niceName } from "@/lib/utils";
import { TZ } from "@/server/scope";
import { Blank } from "@/components/ui/blank";

export const metadata: Metadata = { title: "Activities" };

const TABS = [
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "done", label: "Done" },
] as const;

export default async function ActivitiesPage({ searchParams }: PageProps<"/activities">) {
  const session = await requirePermission("leads.view");
  const raw = (await searchParams).tab;
  const tab = TABS.some((t) => t.key === raw) ? (raw as (typeof TABS)[number]["key"]) : "today";

  const day = sql`(${activities.startsAt} at time zone ${TZ})::date`;
  const today = sql`(now() at time zone ${TZ})::date`;
  const planned = sql`${activities.type} in ('call','meeting','task') and ${activities.startsAt} is not null`;
  const where =
    tab === "today" ? sql`${planned} and not ${activities.done} and ${day} = ${today}`
    : tab === "overdue" ? sql`${planned} and not ${activities.done} and ${activities.startsAt} < now() and ${day} < ${today}`
    : tab === "upcoming" ? sql`${planned} and not ${activities.done} and ${day} > ${today}`
    : sql`${planned} and ${activities.done}`;

  const own = session.user.viewScope === "own" ? sql`and (${leads.ownerId} = ${session.user.id} or ${activities.userId} = ${session.user.id})` : sql``;

  const rows = await db
    .select({ id: activities.id, type: activities.type, title: activities.title, comment: activities.comment, startsAt: activities.startsAt, done: activities.done, leadId: leads.id, learner: learners.name, user: users.name })
    .from(activities)
    .leftJoin(leads, eq(leads.id, activities.leadId))
    .leftJoin(learners, eq(learners.id, sql`coalesce(${activities.learnerId}, ${leads.learnerId})`))
    .leftJoin(users, eq(users.id, activities.userId))
    .where(and(sql`${where} ${own}`))
    .orderBy(tab === "done" ? desc(activities.startsAt) : sql`${activities.startsAt} asc`)
    .limit(200);

  return (
    <>
      <PageHeader title="Activities" subtitle="Calls, meetings and tasks planned on enquiries." crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Activities" }]} />
      <nav className="mb-3 inline-flex gap-1 rounded-full border border-border p-1" aria-label="Filter">
        {TABS.map((t) => (
          <Link key={t.key} href={`/activities?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${t.key === tab ? "bg-brand text-brand-foreground" : "hover:bg-muted"}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <Card className="p-0">
        {rows.length === 0 ? (
          <EmptyState title="Nothing here" hint={tab === "today" ? "No calls or meetings are planned for today. Plan one from an enquiry's page." : undefined} />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className={`font-semibold ${a.done ? "line-through opacity-60" : ""}`}>{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.learner ? (a.leadId ? <Link href={`/leads/${a.leadId}`} className="text-brand hover:underline">{niceName(a.learner)}</Link> : niceName(a.learner)) : <Blank />}
                    {a.user ? ` · ${a.user}` : ""}
                  </p>
                  {a.comment && <p className="text-xs text-muted-foreground">{a.comment}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{a.type}</Badge>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(a.startsAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
