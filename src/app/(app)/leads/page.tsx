import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { LEAD_SORTS, listLeads, type LeadFilters } from "@/server/leads";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { FilterBar, FilterField, buildChips } from "@/components/filters/filter-bar";
import { isoDate, num, oneOf, text } from "@/lib/list-params";
import { EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/page";
import { StageSelect } from "@/components/leads/stage-select";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { formatDate, formatMoney, niceName, yearLabel } from "@/lib/utils";
import { deleteLeadAction } from "./actions";
import { QuickLook } from "@/components/quick-look";
import { StageBadge } from "@/components/stage-badge";
import { Blank } from "@/components/ui/blank";

export const metadata: Metadata = { title: "Enquiries" };

const PAGE_SIZE = 20;
const BOARD_LIMIT = 300;

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const session = await requirePermission("leads.view");
  const sp = await searchParams;
  const board = text(sp.view) === "board";
  const page = num(sp.page) ?? 1;
  const sort = oneOf(sp.sort, LEAD_SORTS.filter((x) => !x.startsWith("enrolled"))) ?? "newest";
  const filters: LeadFilters = {
    q: text(sp.q), stageId: num(sp.stage), sourceId: num(sp.source), ownerId: num(sp.owner), programId: num(sp.program), collegeId: num(sp.college),
    minFee: num(sp.min_fee), maxFee: num(sp.max_fee), from: isoDate(sp.from), to: isoDate(sp.to), sort,
  };

  const [options, { rows, total }] = await Promise.all([getOptions(), listLeads(session, filters, board ? 1 : page, board ? BOARD_LIMIT : PAGE_SIZE)]);
  const stages = options.stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind }));
  const canEdit = session.can("leads.edit");

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "page" && k !== "saved" && typeof v === "string" && v) query.set(k, v);
  const withParams = (extra: Record<string, string>) => {
    const p = new URLSearchParams(query);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return `/leads?${p}`;
  };
  const exportQuery = new URLSearchParams(query);
  exportQuery.delete("view");

  const chips = buildChips("/leads", sp, [
    { key: "q", label: "Search", value: filters.q },
    { key: "stage", label: "Status", value: options.stages.find((x) => x.id === filters.stageId)?.name },
    { key: "source", label: "Source", value: options.sources.find((x) => x.id === filters.sourceId)?.name },
    { key: "owner", label: "Counsellor", value: options.counsellors.find((u) => u.id === filters.ownerId)?.name },
    { key: "program", label: "Program", value: options.programs.find((x) => x.id === filters.programId)?.name },
    { key: "college", label: "College", value: options.colleges.find((x) => x.id === filters.collegeId)?.name },
    { key: "min_fee", label: "Fee from", value: filters.minFee ? formatMoney(filters.minFee) : undefined },
    { key: "max_fee", label: "Fee up to", value: filters.maxFee ? formatMoney(filters.maxFee) : undefined },
    { key: "from", label: "From", value: filters.from },
    { key: "to", label: "To", value: filters.to },
  ]);
  const filtersActive = chips.length > 0;

  return (
    <>
      <Suspense>
        <Flash />
      </Suspense>
      <PageHeader
        title="Enquiries"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Enquiries" }]}
        actions={
          <>
            {session.can("leads.import") && (
              <ButtonLink href="/leads/import" variant="secondary">
                Import
              </ButtonLink>
            )}
            {session.can("leads.export") && (
              <details className="relative">
                <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-foreground px-4 text-sm font-semibold hover:bg-brand-tint [&::-webkit-details-marker]:hidden">
                  Export
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-border bg-card p-1.5 shadow-lg">
                  <a className="block rounded-lg px-3 py-2 text-sm hover:bg-muted" href={`/api/export/leads?format=xlsx&${exportQuery}`}>Excel (.xlsx)</a>
                  <a className="block rounded-lg px-3 py-2 text-sm hover:bg-muted" href={`/api/export/leads?format=csv&${exportQuery}`}>CSV</a>
                </div>
              </details>
            )}
            {session.can("leads.create") && <ButtonLink href="/leads/new">Create enquiry</ButtonLink>}
          </>
        }
      />

      <Card className="p-0">
        <FilterBar
          basePath="/leads"
          hidden={board ? { view: "board" } : undefined}
          search={{ value: filters.q, placeholder: "Search name, phone, email, college…" }}
          sort={{ value: sort, options: [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "fee_desc", label: "Fee: high to low" }, { value: "fee_asc", label: "Fee: low to high" }, { value: "name", label: "Learner A to Z" }] }}
          chips={chips}
          extra={
            <nav className="flex gap-1 rounded-full border border-border p-1" aria-label="View">
              <Link href={withParams({ view: "list" })} aria-current={!board ? "true" : undefined} className={`rounded-full px-3 py-1 text-xs font-semibold ${!board ? "bg-brand text-brand-foreground" : "hover:bg-muted"}`}>List</Link>
              <Link href={withParams({ view: "board" })} aria-current={board ? "true" : undefined} className={`rounded-full px-3 py-1 text-xs font-semibold ${board ? "bg-brand text-brand-foreground" : "hover:bg-muted"}`}>Board</Link>
            </nav>
          }
        >
          <FilterField label="Status">
            <Select name="stage" defaultValue={sp.stage as string} className="w-full">
              <option value="">All statuses</option>
              {options.stages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Program">
            <Select name="program" defaultValue={sp.program as string} className="w-full">
              <option value="">All programs</option>
              {options.programs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Source">
            <Select name="source" defaultValue={sp.source as string} className="w-full">
              <option value="">All sources</option>
              {options.sources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="College">
            <Select name="college" defaultValue={sp.college as string} className="w-full">
              <option value="">All colleges</option>
              {options.colleges.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </FilterField>
          {session.user.viewScope === "all" && (
            <FilterField label="Counsellor">
              <Select name="owner" defaultValue={sp.owner as string} className="w-full">
                <option value="">All counsellors</option>
                {options.counsellors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </FilterField>
          )}
          <FilterField label="Fee from (₹)"><Input name="min_fee" type="number" min={0} step={1000} defaultValue={filters.minFee} className="w-full" /></FilterField>
          <FilterField label="Fee up to (₹)"><Input name="max_fee" type="number" min={0} step={1000} defaultValue={filters.maxFee} className="w-full" /></FilterField>
          <FilterField label="Enquiry from"><Input name="from" type="date" defaultValue={filters.from} className="w-full" /></FilterField>
          <FilterField label="Enquiry to"><Input name="to" type="date" defaultValue={filters.to} className="w-full" /></FilterField>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            title={filtersActive ? "No enquiries match these filters" : "No enquiries yet"}
            hint={filtersActive ? "Try clearing a filter." : "Create the first one, or import your learners from a spreadsheet."}
            action={!filtersActive && session.can("leads.create") ? <ButtonLink href="/leads/new">Create enquiry</ButtonLink> : undefined}
          />
        ) : board ? (
          <div className="thin-scroll flex gap-3 overflow-x-auto p-3 md:p-4">
            {options.stages.map((s) => {
              const col = rows.filter((r) => r.stageId === s.id);
              return (
                <section key={s.id} className="w-72 shrink-0 rounded-2xl bg-muted/60 p-2" aria-label={s.name}>
                  <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-bold">
                    {s.name}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{col.length}</span>
                  </h2>
                  <ul className="space-y-2">
                    {col.map((r) => (
                      <li key={r.id} className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                        <Link href={`/leads/${r.id}`} className="block truncate text-sm font-semibold hover:underline">{niceName(r.learner)}</Link>
                        <p className="truncate text-xs text-muted-foreground">{[r.program, r.batch].filter(Boolean).join(" · ") || r.title}</p>
                        <p className="mt-1 flex justify-between text-xs text-muted-foreground">
                          <span>{r.owner ?? "Unassigned"}</span>
                          <span className="font-semibold text-foreground">{formatMoney(r.finalFee ?? r.courseFee)}</span>
                        </p>
                        {canEdit && <div className="mt-2"><StageSelect leadId={r.id} stageId={r.stageId} stages={stages} /></div>}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="px-1 pb-3 md:px-2">
            <Table>
              <thead>
                <tr>
                  <Th className="w-12">Sr</Th><Th>Learner</Th><Th>Status</Th><Th>Program · Batch</Th><Th className="text-right">Final fee</Th><Th>Enquiry date</Th><Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-muted/50"><Td className="tabular-nums text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</Td>
                    <Td>
                      <QuickLook
                        data={{
                          id: r.learnerId, name: r.learner, phone: r.phones[0], email: r.emails[0], college: r.college, branch: r.branch,
                          year: r.year ? yearLabel(r.year) : null, city: r.city, owner: r.owner,
                          badge: <StageBadge name={r.stage} kind={r.stageKind} />,
                          stats: [{ label: "Fee", value: formatMoney(r.finalFee ?? r.courseFee) }],
                          canCreateEnquiry: false,
                        }}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{niceName(r.learner)}</p>
                          <p className="max-w-56 truncate text-xs tabular-nums text-muted-foreground">{[r.phones[0], r.college].filter(Boolean).join(" · ")}</p>
                        </div>
                      </QuickLook>
                    </Td>
                    <Td>
                      {canEdit ? <StageSelect leadId={r.id} stageId={r.stageId} stages={stages} /> : <span className="text-xs font-semibold">{r.stage}</span>}
                    </Td>
                    <Td>{r.program ? <>{r.program}{r.batch && <span className="text-muted-foreground"> · {r.batch}</span>}</> : <Blank />}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(r.finalFee ?? r.courseFee)}</Td>
                    <Td className="whitespace-nowrap">{formatDate(r.createdAt)}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <ButtonLink href={`/leads/${r.id}`} variant="ghost" size="icon" aria-label={`View ${r.learner}`}><Eye size={16} /></ButtonLink>
                        {canEdit && <ButtonLink href={`/leads/${r.id}/edit`} variant="ghost" size="icon" aria-label={`Edit ${r.learner}`}><Pencil size={16} /></ButtonLink>}
                        {session.can("leads.delete") && (
                          <form action={deleteLeadAction.bind(null, r.id)}>
                            <ConfirmButton message={`Delete the enquiry for ${r.learner}? This cannot be undone.`} variant="ghost" size="icon" aria-label={`Delete ${r.learner}`}><Trash2 size={16} /></ConfirmButton>
                          </form>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => withParams({ page: String(p) })} />
          </div>
        )}
      </Card>
    </>
  );
}
