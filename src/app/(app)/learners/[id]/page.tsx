import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { getLearner, getLearnerLeads } from "@/server/learners";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { StageBadge } from "@/components/stage-badge";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { formatDate, formatMoney, initials, yearLabel, parseId, niceName, niceTitle } from "@/lib/utils";
import { deleteLearnerAction } from "../actions";
import { Blank } from "@/components/ui/blank";

export const metadata: Metadata = { title: "Learner" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children || <Blank />}</dd>
    </div>
  );
}

export default async function LearnerPage({ params }: PageProps<"/learners/[id]">) {
  const session = await requirePermission("learners.view");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const learner = await getLearner(session, id);
  if (!learner) notFound();
  const enquiries = await getLearnerLeads(id);
  const manage = session.can("learners.manage");

  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader
        title={niceName(learner.name)}
        subtitle={learner.kind === "professional" ? "Working professional" : "Student"}
        crumbs={[{ label: "Learners", href: "/learners" }, { label: `#${learner.id}` }]}
        actions={
          <>
            {session.can("leads.create") && <ButtonLink href={`/leads/new?learner=${id}`}>Create enquiry</ButtonLink>}
            {session.can("quotes.create") && <ButtonLink href={`/quotes/new?learner=${id}`} variant="secondary">Create quote</ButtonLink>}
            {manage && <ButtonLink href={`/learners/${id}/edit`} variant="secondary">Edit</ButtonLink>}
            {manage && (
              <form action={deleteLearnerAction.bind(null, id)}>
                <ConfirmButton message={`Delete ${learner.name} and all their enquiries? This cannot be undone.`} variant="danger-outline">Delete</ConfirmButton>
              </form>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <Card className="order-2 lg:sticky lg:top-20">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand">{initials(learner.name)}</span>
            <CardTitle>Details</CardTitle>
          </div>
          <dl className="divide-y divide-border">
            <Row label="Phone">{learner.phones.length > 0 && learner.phones.map((p) => <a key={p} href={`tel:${p}`} className="mr-2 text-brand hover:underline">{p}</a>)}</Row>
            <Row label="Email">{learner.emails.length > 0 && learner.emails.map((e) => <a key={e} href={`mailto:${e}`} className="mr-2 text-brand hover:underline">{e}</a>)}</Row>
            <Row label="College">{learner.college}</Row>
            <Row label="Year">{learner.year ? yearLabel(learner.year) : null}</Row>
            <Row label="Branch">{learner.branch}</Row>
            <Row label="Degree / Course">{learner.qualification}</Row>
            <Row label="City">{learner.city}</Row>
            <Row label="Counsellor">{learner.owner}</Row>
            <Row label="Added">{formatDate(learner.createdAt)}</Row>
          </dl>
        </Card>

        <Card className="order-1">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <CardTitle>Enquiries</CardTitle>
            <span className="text-sm text-muted-foreground">{enquiries.length} in total</span>
          </div>
          {enquiries.length === 0 ? (
            <EmptyState title="No enquiries yet" hint="Create one to start tracking this learner through the pipeline." />
          ) : (
            <ul className="divide-y divide-border">
              {enquiries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    {session.can("leads.view") ? <Link href={`/leads/${e.id}`} className="truncate font-semibold hover:underline">{niceTitle(e.title)}</Link> : <p className="truncate font-semibold">{niceTitle(e.title)}</p>}
                    <p className="text-xs text-muted-foreground">{formatDate(e.createdAt)} · {formatMoney(e.finalFee ?? e.courseFee)}</p>
                  </div>
                  <StageBadge name={e.stage} kind={e.kind} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
