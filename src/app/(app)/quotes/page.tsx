import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { listQuotes, QUOTE_SORTS, quoteNumber } from "@/server/quotes";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { Blank } from "@/components/ui/blank";
import { EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/page";
import { ConfirmButton } from "@/components/confirm-button";
import { FilterBar, FilterField, buildChips } from "@/components/filters/filter-bar";
import { getOptions } from "@/server/options";
import { isoDate, num, oneOf, text } from "@/lib/list-params";
import { Flash } from "@/components/flash";
import { formatDate, formatMoney, niceName } from "@/lib/utils";
import { deleteQuoteAction } from "./actions";

export const metadata: Metadata = { title: "Quotes" };
const PAGE_SIZE = 25;

export default async function QuotesPage({ searchParams }: PageProps<"/quotes">) {
  const session = await requirePermission("quotes.view");
  const sp = await searchParams;
  const q = text(sp.q) ?? "";
  const page = num(sp.page) ? Math.min(num(sp.page)!, 10_000) : 1;
  const sort = oneOf(sp.sort, QUOTE_SORTS) ?? "newest";
  const filters = {
    q, sort, page, pageSize: PAGE_SIZE,
    kind: oneOf(sp.kind, ["learner", "college", "vendor", "other"] as const),
    validity: oneOf(sp.validity, ["active", "expired"] as const),
    ownerId: num(sp.owner), from: isoDate(sp.from), to: isoDate(sp.to),
  };
  const [options, { rows, total }] = await Promise.all([getOptions(), listQuotes(session, filters)]);
  const chips = buildChips("/quotes", sp, [
    { key: "q", label: "Search", value: q || undefined },
    { key: "kind", label: "For", value: filters.kind ? { learner: "Learner", college: "College / institute", vendor: "Vendor / company", other: "Other" }[filters.kind] : undefined },
    { key: "validity", label: "Validity", value: filters.validity === "active" ? "Still valid" : filters.validity === "expired" ? "Expired" : undefined },
    { key: "owner", label: "Sales person", value: options.counsellors.find((u) => u.id === filters.ownerId)?.name },
    { key: "from", label: "Created from", value: filters.from },
    { key: "to", label: "Created to", value: filters.to },
  ]);
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "page" && k !== "saved" && typeof v === "string" && v) query.set(k, v);
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
        <FilterBar
          basePath="/quotes"
          search={{ value: q, placeholder: "Search subject, name or quote number…" }}
          sort={{ value: sort, options: [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "total_desc", label: "Total: high to low" }, { value: "total_asc", label: "Total: low to high" }, { value: "expiring", label: "Expiring soonest" }] }}
          chips={chips}
        >
          <FilterField label="Quote for">
            <Select name="kind" defaultValue={sp.kind as string} className="w-full">
              <option value="">Anyone</option>
              <option value="learner">Learner</option>
              <option value="college">College / institute</option>
              <option value="vendor">Vendor / company</option>
              <option value="other">Other</option>
            </Select>
          </FilterField>
          <FilterField label="Validity">
            <Select name="validity" defaultValue={sp.validity as string} className="w-full">
              <option value="">Any</option>
              <option value="active">Still valid</option>
              <option value="expired">Expired</option>
            </Select>
          </FilterField>
          {session.user.viewScope === "all" && (
            <FilterField label="Sales person">
              <Select name="owner" defaultValue={sp.owner as string} className="w-full">
                <option value="">Everyone</option>
                {options.counsellors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </FilterField>
          )}
          <FilterField label="Created from"><Input name="from" type="date" defaultValue={filters.from} className="w-full" /></FilterField>
          <FilterField label="Created to"><Input name="to" type="date" defaultValue={filters.to} className="w-full" /></FilterField>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState
            title={chips.length ? "No quotes match these filters" : "No quotes yet"}
            hint={chips.length ? "Try removing a filter." : "Create a quote for a learner, or open an enquiry and choose Create quote."}
            action={!chips.length && session.can("quotes.create") ? <ButtonLink href="/quotes/new">Create quote</ButtonLink> : undefined}
          />
        ) : (
          <div className="px-1 pb-3 md:px-2">
            <Table>
              <thead>
                <tr>
                  <Th className="w-12">Sr</Th><Th>Quote</Th><Th>Quote to</Th><Th className="text-right">Grand total</Th><Th>Valid until</Th><Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const expired = !!r.expiredAt && r.expiredAt < today;
                  return (
                    <tr key={r.id} className="hover:bg-muted/50"><Td className="tabular-nums text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</Td>
                      <Td>
                        <Link href={`/quotes/${r.id}`} className="font-semibold hover:text-brand hover:underline">{r.subject}</Link>
                        <p className="text-xs text-muted-foreground">{quoteNumber(r.id)} · {formatDate(r.createdAt)}{r.owner ? ` · ${r.owner}` : ""}</p>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={r.learner} />
                          {r.learnerId ? <Link href={`/learners/${r.learnerId}`} className="hover:text-brand hover:underline">{niceName(r.learner)}</Link> : <span>{r.learner} <Badge tone="muted" className="ml-1 capitalize">{r.recipientKind}</Badge></span>}
                        </div>
                      </Td>
                      <Td className="text-right font-semibold tabular-nums">{formatMoney(r.grandTotal)}</Td>
                      <Td className="whitespace-nowrap">
                        {r.expiredAt ? (
                          <span className={expired ? "font-semibold text-danger" : ""}>{formatDate(r.expiredAt)}{expired && " (expired)"}</span>
                        ) : (
                          <Blank />
                        )}
                      </Td>
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
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/quotes?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) })}`} />
          </div>
        )}
      </Card>
    </>
  );
}
