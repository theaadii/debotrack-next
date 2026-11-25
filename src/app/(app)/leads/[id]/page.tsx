import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarClock, CheckCircle2, Circle, Info, ListChecks, Mail, Phone, StickyNote, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { quotesForLead, quoteNumber } from "@/server/quotes";
import { getLead, getLeadActivities } from "@/server/leads";
import { getOptions } from "@/server/options";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { StageBar } from "@/components/leads/stage-bar";
import { ActivityForm } from "@/components/leads/activity-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { formatDate, formatDateTime, formatMoney, initials, yearLabel, parseId, niceName, niceTitle } from "@/lib/utils";
import { addActivityAction, deleteLeadAction, toggleActivityAction } from "../actions";
import { Blank } from "@/components/ui/blank";

export const metadata: Metadata = { title: "Enquiry" };

const ICONS = { note: StickyNote, call: Phone, meeting: Users, task: ListChecks, email: Mail, system: Info } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || <Blank />}</dd>
    </div>
  );
}

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const session = await requireSession();
  if (!session.can("leads.view")) return notFound();
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const lead = await getLead(session, id);
  if (!lead) notFound();

  const [options, timeline, leadQuotes] = await Promise.all([getOptions(), getLeadActivities(id), session.can("quotes.view") ? quotesForLead(session, id) : Promise.resolve([])]);
  const stages = options.stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind }));
  const canEdit = session.can("leads.edit");
  const discount = lead.discountType && lead.discountValue ? (lead.discountType === "percent" ? `${Number(lead.discountValue)}% off` : `${formatMoney(lead.discountValue)} off`) : null;

  return (
    <>
      <Suspense>
        <Flash />
      </Suspense>
      <PageHeader
        title={niceName(lead.learner)}
        subtitle={niceTitle(lead.title)}
        crumbs={[{ label: "Enquiries", href: "/leads" }, { label: `#${lead.id}` }]}
        actions={
          <>
            {canEdit && <ButtonLink href={`/leads/${id}/edit`} variant="secondary">Edit</ButtonLink>}
            {session.can("leads.delete") && (
              <form action={deleteLeadAction.bind(null, id)}>
                <ConfirmButton message={`Delete the enquiry for ${lead.learner}? This cannot be undone.`} variant="danger-outline">Delete</ConfirmButton>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="order-2 space-y-4 lg:sticky lg:top-20">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand">{initials(lead.learner)}</span>
              <div className="min-w-0">
                <CardTitle>Student</CardTitle>
                {session.can("learners.view") && (
                  <Link href={`/learners/${lead.learnerId}`} className="text-xs font-semibold text-brand hover:underline">Open profile</Link>
                )}
              </div>
            </div>
            <dl className="divide-y divide-border">
              <Row label="Phone">{lead.phones.length > 0 && lead.phones.map((p) => <a key={p} href={`tel:${p}`} className="mr-2 text-brand hover:underline">{p}</a>)}</Row>
              <Row label="Email">{lead.emails.length > 0 && lead.emails.map((e) => <a key={e} href={`mailto:${e}`} className="mr-2 text-brand hover:underline">{e}</a>)}</Row>
              <Row label="College">{lead.college}</Row>
              <Row label="Year">{lead.year ? yearLabel(lead.year) : null}</Row>
              <Row label="Branch">{lead.branch}</Row>
              <Row label="Qualification">{lead.qualification}</Row>
              <Row label="City">{lead.city}</Row>
            </dl>
          </Card>

          {(session.can("quotes.view") || session.can("quotes.create")) && (
            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <CardTitle>Quotes</CardTitle>
                {session.can("quotes.create") && <ButtonLink href={`/quotes/new?lead=${id}`} size="sm" variant="secondary">Create quote</ButtonLink>}
              </div>
              {leadQuotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quotes for this enquiry yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {leadQuotes.map((qt) => (
                    <li key={qt.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <Link href={`/quotes/${qt.id}`} className="block truncate font-semibold hover:text-brand hover:underline">{qt.subject}</Link>
                        <p className="text-xs text-muted-foreground">{quoteNumber(qt.id)}, {formatDate(qt.createdAt)}</p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{formatMoney(qt.grandTotal)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card>
            <CardTitle className="mb-2">Lead details</CardTitle>
            <dl className="divide-y divide-border">
              <Row label="Lead type">{lead.type}</Row>
              <Row label="Source">{lead.source}</Row>
              <Row label="Program">{lead.program}</Row>
              <Row label="Batch">{lead.batch}</Row>
              <Row label="Course fee">{lead.courseFee ? formatMoney(lead.courseFee) : null}</Row>
              <Row label="Discount">{discount}</Row>
              <Row label="Final fee">{lead.finalFee ? <strong>{formatMoney(lead.finalFee)}</strong> : null}</Row>
              <Row label="Counsellor">{lead.owner}</Row>
              <Row label="Expected enrolment">{lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : null}</Row>
              <Row label="Enquiry date">{formatDate(lead.createdAt)}</Row>
              <Row label="Remarks">{lead.remarks}</Row>
            </dl>
          </Card>
        </div>

        <div className="order-1 min-w-0 space-y-4">
          <Card className="p-0">
            <dl className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
              <div className="p-4 md:p-5">
                <dt className="text-sm text-muted-foreground">Final fee</dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{lead.finalFee ? formatMoney(lead.finalFee) : <Blank />}</dd>
                <p className="mt-0.5 text-xs text-muted-foreground">{discount ?? "No discount"}</p>
              </div>
              <div className="min-w-0 p-4 md:p-5">
                <dt className="text-sm text-muted-foreground">Program</dt>
                <dd className="mt-1 truncate text-base font-bold">{lead.program ?? <Blank />}</dd>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.batch ?? "No batch chosen"}</p>
              </div>
              <div className="min-w-0 p-4 md:p-5">
                <dt className="text-sm text-muted-foreground">Counsellor</dt>
                <dd className="mt-1 truncate text-base font-bold">{lead.owner ?? <Blank />}</dd>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.source ? `Source: ${lead.source}` : "No source"}</p>
              </div>
              <div className="min-w-0 p-4 md:p-5">
                <dt className="text-sm text-muted-foreground">Expected enrolment</dt>
                <dd className="mt-1 text-base font-bold">{lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : <Blank />}</dd>
                <p className="mt-0.5 text-xs text-muted-foreground">Enquired {formatDate(lead.createdAt)}</p>
              </div>
            </dl>
          </Card>

          <Card>
            <StageBar leadId={id} stageId={lead.stageId} stages={stages} canEdit={canEdit} />
          </Card>

          {session.can("activities.manage") && (
            <Card>
              <CardTitle className="mb-3">Add a note or plan a follow-up</CardTitle>
              <ActivityForm action={addActivityAction.bind(null, id)} />
            </Card>
          )}

          <Card>
            <CardTitle className="mb-3">Activity</CardTitle>
            {timeline.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ol className="space-y-4">
                {timeline.map((a) => {
                  const Icon = ICONS[a.type];
                  const toggleable = a.type === "call" || a.type === "meeting" || a.type === "task";
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand" aria-hidden>
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <p className={`text-sm font-semibold ${a.done && toggleable ? "line-through opacity-60" : ""}`}>{a.title}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}{a.user ? ` · ${a.user}` : ""}</p>
                        </div>
                        {a.comment && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{a.comment}</p>}
                        {a.startsAt && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock size={13} aria-hidden /> Planned for {formatDateTime(a.startsAt)}
                          </p>
                        )}
                        {toggleable && session.can("activities.manage") && (
                          <form action={toggleActivityAction.bind(null, a.id, id)} className="mt-1">
                            <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                              {a.done ? <CheckCircle2 size={14} /> : <Circle size={14} />} {a.done ? "Done, mark as open" : "Mark as done"}
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
