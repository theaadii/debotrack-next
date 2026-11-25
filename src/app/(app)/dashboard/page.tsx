import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getDashboard } from "@/server/dashboard";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { StageBadge } from "@/components/stage-badge";
import { formatDate, formatMoney, niceName, niceTitle } from "@/lib/utils";
import { EnquiryChart } from "./chart";

export const metadata: Metadata = { title: "Dashboard" };

const PERIODS = [7, 30, 90] as const;

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const session = await requireSession();
  const raw = Number((await searchParams).days);
  const days = (PERIODS as readonly number[]).includes(raw) ? raw : 30;
  const d = await getDashboard(session, days);
  const totalOpen = d.stages.reduce((n, s) => n + s.count, 0);

  const stats = [
    { label: "New enquiries", value: String(d.newEnq), note: "in this period" },
    { label: "Enrolled", value: String(d.enrolled), note: "in this period" },
    { label: "Conversion", value: d.conversion === null ? "No data" : `${d.conversion}%`, note: "of these enquiries enrolled" },
    { label: "Fees enrolled", value: formatMoney(d.fees), note: "after discounts" },
    { label: "Open enquiries", value: String(d.openEnq), note: d.cold ? `${d.cold} going cold (14+ days)` : "none going cold" },
    { label: "Follow-ups today", value: String(d.followUps.length), note: d.overdue ? `${d.overdue} overdue` : "none overdue" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Admissions at a glance"
        actions={
          <nav className="flex gap-1 rounded-full border border-border bg-card p-1" aria-label="Period">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/dashboard?days=${p}`}
                aria-current={p === days ? "true" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${p === days ? "bg-brand text-brand-foreground" : "hover:bg-muted"}`}
              >
                Last {p} days
              </Link>
            ))}
          </nav>
        }
      />

      <Card className="mb-4 p-0">
        <dl className="grid grid-cols-2 divide-x divide-y divide-border md:grid-cols-3 xl:grid-cols-6 xl:divide-y-0" aria-label="Key numbers">
          {stats.map((s) => (
            <div key={s.label} className="p-4 md:p-5">
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{s.value}</dd>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="mb-4">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <CardTitle>Where learners are now</CardTitle>
          <span className="text-sm text-muted-foreground">{d.openEnq} open</span>
        </div>
        {d.openEnq === 0 || totalOpen === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No open enquiries right now.</p>
        ) : (
          <>
            <div className="flex h-3 gap-1 overflow-hidden rounded-full" role="img" aria-label={d.stages.map((s) => `${s.name} ${s.count}`).join(", ")}>
              {d.stages.filter((s) => s.count > 0).map((s, i) => (
                <span key={s.id} className="h-full min-w-2 rounded-full bg-brand" style={{ flexGrow: s.count, opacity: Math.max(0.35, 1 - i * 0.18) }} />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
              {d.stages.map((s) => (
                <li key={s.id} className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">{s.name}</p>
                  <p className="text-xl font-bold tabular-nums">{s.count}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-baseline gap-2">
              <CardTitle>Enquiries &amp; enrolments</CardTitle>
              <span className="text-xs text-muted-foreground">per day</span>
            </div>
            <EnquiryChart data={d.series} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { title: "Enquiries by source", rows: d.bySource },
              { title: "Enquiries by program", rows: d.byProgram },
            ].map((g) => (
              <Card key={g.title}>
                <CardTitle className="mb-3">{g.title}</CardTitle>
                {g.rows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nothing in this period.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-1 font-semibold">Name</th><th className="pb-1 text-right font-semibold">Enquiries</th><th className="pb-1 text-right font-semibold">Enrolled</th></tr></thead>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.name} className="border-t border-border"><td className="py-2">{r.name}</td><td className="py-2 text-right tabular-nums">{r.enquiries}</td><td className="py-2 text-right tabular-nums">{r.enrolled}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            ))}
          </div>

          {session.user.viewScope === "all" && (
            <Card>
              <CardTitle className="mb-3">Counsellors</CardTitle>
              {d.counsellors.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No counsellors yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-1 font-semibold">Name</th><th className="pb-1 text-right font-semibold">Enquiries</th><th className="pb-1 text-right font-semibold">Enrolled</th><th className="pb-1 text-right font-semibold">Fees</th></tr></thead>
                  <tbody>
                    {d.counsellors.map((c) => (
                      <tr key={c.name} className="border-t border-border"><td className="py-2">{c.name}</td><td className="py-2 text-right tabular-nums">{c.enquiries}</td><td className="py-2 text-right tabular-nums">{c.enrolled}</td><td className="py-2 text-right tabular-nums">{formatMoney(c.fees)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <CardTitle>Follow-ups today</CardTitle>
              <span className="text-xs text-muted-foreground">{d.followUps.length} planned</span>
            </div>
            {d.followUps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No calls or meetings planned for today.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.followUps.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{f.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.learner ? niceName(f.learner) : "Unknown"} · {f.type}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {f.startsAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/activities" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
              All activities
            </Link>
          </Card>

          <Card>
            <CardTitle className="mb-3">Latest enquiries</CardTitle>
            {d.latest.length === 0 ? (
              <EmptyState
                title="No enquiries yet"
                hint="Add the first one, or import your learners from a spreadsheet."
                action={
                  session.can("leads.create") ? (
                    <Link href="/leads/new" className="text-sm font-semibold text-brand underline">
                      Add the first one
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {d.latest.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/leads/${l.id}`} className="truncate font-semibold hover:underline">
                        {niceName(l.learner)}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {niceTitle(l.title)} · {formatDate(l.createdAt)}
                      </p>
                    </div>
                    <StageBadge name={l.stage} kind={l.kind} />
                  </li>
                ))}
              </ul>
            )}
            <Link href="/leads" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
              All enquiries
            </Link>
          </Card>

          <Card>
            <CardTitle className="mb-3">Upcoming &amp; ongoing batches</CardTitle>
            {d.upcomingBatches.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No open batches. Add one under Programs.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.upcomingBatches.map((b) => (
                  <li key={b.id} className="py-2.5 text-sm">
                    <p className="truncate font-semibold">{b.program} · {b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.startDate ? `Starts ${formatDate(b.startDate)}` : "Start date not set"}
                      {" · "}{b.enrolled}{b.seats ? ` / ${b.seats}` : ""} enrolled, {b.enquiries} enquiries
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
