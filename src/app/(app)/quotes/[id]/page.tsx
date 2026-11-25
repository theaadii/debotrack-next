import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getQuote, quoteNumber } from "@/server/quotes";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Blank } from "@/components/ui/blank";
import { PageHeader, Table, Td, Th } from "@/components/ui/page";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { formatDate, formatMoney, niceName, parseId } from "@/lib/utils";
import { deleteQuoteAction } from "../actions";

export const metadata: Metadata = { title: "Quote" };

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const session = await requirePermission("quotes.view");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const q = await getQuote(session, id);
  if (!q) notFound();

  const expired = !!q.expiredAt && q.expiredAt < new Date().toISOString().slice(0, 10);
  const a = q.billingAddress;
  const addressLines = [a?.address, [a?.city, a?.postcode].filter(Boolean).join(" "), a?.state, a?.country].filter(Boolean) as string[];
  const adjustment = Number(q.adjustmentAmount);

  return (
    <>
      <Suspense>
        <Flash />
      </Suspense>
      <PageHeader
        title={q.subject}
        subtitle={quoteNumber(q.id)}
        crumbs={[{ label: "Quotes", href: "/quotes" }, { label: quoteNumber(q.id) }]}
        actions={
          <>
            <ButtonLink href={`/api/quotes/${q.id}/pdf`} target="_blank"><Download size={16} aria-hidden /> Download PDF</ButtonLink>
            {session.can("quotes.edit") && <ButtonLink href={`/quotes/${q.id}/edit`} variant="secondary">Edit</ButtonLink>}
            {session.can("quotes.delete") && (
              <form action={deleteQuoteAction.bind(null, q.id)}>
                <ConfirmButton message={`Delete quote ${quoteNumber(q.id)}? This cannot be undone.`} variant="danger-outline">Delete</ConfirmButton>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="order-1 min-w-0 space-y-4">
          <Card className="p-0">
            <dl className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
              <div className="p-4 md:p-5">
                <dt className="text-sm text-muted-foreground">Grand total</dt>
                <dd className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-brand">{formatMoney(q.grandTotal)}</dd>
                <p className="mt-0.5 text-xs text-muted-foreground">{q.items.length} item{q.items.length === 1 ? "" : "s"}</p>
              </div>
              <div className="p-4 md:p-5">
                <dt className="text-sm text-muted-foreground">Valid until</dt>
                <dd className={`mt-1 text-base font-bold ${expired ? "text-danger" : ""}`}>{q.expiredAt ? formatDate(q.expiredAt) : <Blank />}</dd>
                <p className="mt-0.5 text-xs text-muted-foreground">{expired ? "This quote has expired" : q.expiredAt ? "Still valid" : "No expiry date"}</p>
              </div>
              <div className="min-w-0 p-4 md:p-5">
                <dt className="text-sm text-muted-foreground">Sales person</dt>
                <dd className="mt-1 truncate text-base font-bold">{q.owner ?? <Blank />}</dd>
              </div>
              <div className="p-4 md:p-5">
                <dt className="text-sm text-muted-foreground">Created</dt>
                <dd className="mt-1 text-base font-bold">{formatDate(q.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          {q.description && (
            <Card>
              <CardTitle className="mb-2">Description</CardTitle>
              <p className="whitespace-pre-wrap text-sm">{q.description}</p>
            </Card>
          )}

          <Card className="p-0">
            <div className="p-4 pb-0 md:p-5 md:pb-0">
              <CardTitle>Items</CardTitle>
            </div>
            <div className="px-1 pb-3 pt-3 md:px-2">
              <Table>
                <thead>
                  <tr>
                    <Th>Item</Th><Th className="text-right">Price</Th><Th className="text-right">Qty</Th><Th className="text-right">Discount</Th><Th className="text-right">Tax</Th><Th className="text-right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((it) => (
                    <tr key={it.id}>
                      <Td>
                        <p className="font-semibold">{it.name}</p>
                        {it.sku && <p className="text-xs text-muted-foreground">SKU {it.sku}</p>}
                      </Td>
                      <Td className="text-right tabular-nums">{formatMoney(it.price)}</Td>
                      <Td className="text-right tabular-nums">{it.quantity}</Td>
                      <Td className="text-right tabular-nums">{Number(it.discountAmount) > 0 ? formatMoney(it.discountAmount) : <Blank />}</Td>
                      <Td className="text-right tabular-nums">{Number(it.taxAmount) > 0 ? <>{formatMoney(it.taxAmount)}<span className="block text-xs text-muted-foreground">{Number(it.taxPercent)}%</span></> : <Blank />}</Td>
                      <Td className="text-right font-semibold tabular-nums">{formatMoney(it.total)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="order-2 space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardTitle className="mb-3">Totals</CardTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sub total</dt><dd className="font-medium tabular-nums">{formatMoney(q.subTotal)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Discount</dt><dd className="font-medium tabular-nums">{Number(q.discountAmount) > 0 ? `− ${formatMoney(q.discountAmount)}` : "None"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Tax</dt><dd className="font-medium tabular-nums">{formatMoney(q.taxAmount)}</dd></div>
              {adjustment !== 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Adjustment</dt><dd className="font-medium tabular-nums">{adjustment < 0 ? "− " : ""}{formatMoney(Math.abs(adjustment))}</dd></div>}
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3"><dt className="font-bold">Grand total</dt><dd className="text-xl font-extrabold tabular-nums text-brand">{formatMoney(q.grandTotal)}</dd></div>
            </dl>
          </Card>

          <Card>
            <CardTitle className="mb-3">Bill to</CardTitle>
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={q.learner} />
              <div className="min-w-0">
                {session.can("learners.view") ? <Link href={`/learners/${q.learnerId}`} className="truncate font-semibold hover:text-brand hover:underline">{niceName(q.learner)}</Link> : <p className="truncate font-semibold">{niceName(q.learner)}</p>}
                <p className="truncate text-xs text-muted-foreground">{[q.phones[0], q.emails[0]].filter(Boolean).join(", ")}</p>
              </div>
            </div>
            {addressLines.length > 0 ? <address className="text-sm not-italic text-muted-foreground">{addressLines.map((l) => <span key={l} className="block">{l}</span>)}</address> : <p className="text-sm text-muted-foreground">No billing address.</p>}
            {q.leadId && session.can("leads.view") && (
              <p className="mt-3 text-sm">
                Enquiry: <Link href={`/leads/${q.leadId}`} className="font-semibold text-brand hover:underline">{q.leadTitle ?? `#${q.leadId}`}</Link>
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
