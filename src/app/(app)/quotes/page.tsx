import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { listQuotes, quoteNumber } from "@/server/quotes";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { Blank } from "@/components/ui/blank";
import { EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/page";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { formatDate, formatMoney, niceName } from "@/lib/utils";
import { deleteQuoteAction } from "./actions";

export const metadata: Metadata = { title: "Quotes" };
const PAGE_SIZE = 25;

export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  const session = await requirePermission("quotes.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const pageNum = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(pageNum) && pageNum > 0 ? Math.min(pageNum, 10_000) : 1;
  const { rows, total } = await listQuotes(session, { q, page, pageSize: PAGE_SIZE });
  const today = new Date().toISOString().slice(0, 10);

  const canEdit = session.can("quotes.edit");
  const canDelete = session.can("quotes.delete");

  return (
    <>
      <Suspense>
        <Flash />
      </Suspense>
      <PageHeader
        title="Quotes"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Quotes" }]}
        actions={session.can("quotes.create") ? <ButtonLink href="/quotes/new"><Plus size={16} aria-hidden /> Create quote</ButtonLink> : undefined}
      />
      <Card className="p-0">
        <form className="flex gap-2 border-b border-border p-3 md:p-4" role="search">
          <Input name="q" type="search" placeholder="Search subject, learner or quote number…" defaultValue={q} aria-label="Search" maxLength={80} />
          <Button type="submit">Search</Button>
          {q && <ButtonLink href="/quotes" variant="ghost">Clear</ButtonLink>}
        </form>
        {rows.length === 0 ? (
          <EmptyState
            title={q ? "No quotes match your search" : "No quotes yet"}
            hint={q ? "Try a different word, or clear the search." : "Create a quote for a learner, or open an enquiry and choose Create quote."}
            action={!q && session.can("quotes.create") ? <ButtonLink href="/quotes/new">Create quote</ButtonLink> : undefined}
          />
        ) : (
          <div className="px-1 pb-3 md:px-2">
            <Table>
              <thead>
                <tr>
                  <Th>Quote</Th><Th>Learner</Th><Th>Sales person</Th><Th className="text-right">Grand total</Th><Th>Valid until</Th><Th>Created</Th><Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expired = !!r.expiredAt && r.expiredAt < today;
                  return (
                    <tr key={r.id} className="hover:bg-muted/50">
                      <Td>
                        <Link href={`/quotes/${r.id}`} className="font-semibold hover:text-brand hover:underline">{r.subject}</Link>
                        <p className="text-xs text-muted-foreground">{quoteNumber(r.id)}</p>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.learner} />
                          <Link href={`/learners/${r.learnerId}`} className="hover:text-brand hover:underline">{niceName(r.learner)}</Link>
                        </div>
                      </Td>
                      <Td>{r.owner ?? <Blank />}</Td>
                      <Td className="text-right font-semibold tabular-nums">{formatMoney(r.grandTotal)}</Td>
                      <Td className="whitespace-nowrap">
                        {r.expiredAt ? (
                          <span className={expired ? "font-semibold text-danger" : ""}>{formatDate(r.expiredAt)}{expired && " (expired)"}</span>
                        ) : (
                          <Blank />
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(r.createdAt)}</Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <ButtonLink href={`/api/quotes/${r.id}/pdf`} target="_blank" variant="ghost" size="icon" aria-label={`Download PDF for ${r.subject}`}><Download size={16} /></ButtonLink>
                          {canEdit && <ButtonLink href={`/quotes/${r.id}/edit`} variant="ghost" size="icon" aria-label={`Edit ${r.subject}`}><Pencil size={16} /></ButtonLink>}
                          {canDelete && (
                            <form action={deleteQuoteAction.bind(null, r.id)}>
                              <ConfirmButton message={`Delete quote ${quoteNumber(r.id)} (${r.subject})? This cannot be undone.`} variant="ghost" size="icon" aria-label={`Delete ${r.subject}`}><Trash2 size={16} /></ConfirmButton>
                            </form>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/quotes?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} />
          </div>
        )}
      </Card>
    </>
  );
}
