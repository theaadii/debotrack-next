import type { Metadata } from "next";
import { Suspense } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { listLearners } from "@/server/learners";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Input } from "@/components/ui/field";
import { FilterBar, FilterField, buildChips } from "@/components/filters/filter-bar";
import { LEARNER_SORTS } from "@/server/learners";
import { isoDate, num, oneOf, text } from "@/lib/list-params";
import { EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/page";
import { LearnersTabs } from "@/components/learners-tabs";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { formatDate, yearLabel, niceName } from "@/lib/utils";
import { deleteLearnerAction } from "./actions";
import { QuickLook } from "@/components/quick-look";
import { Blank } from "@/components/ui/blank";
import { EnrolmentBadge } from "@/components/enrolment-badge";

export const metadata: Metadata = { title: "Learners" };
const PAGE_SIZE = 25;

export default async function LearnersPage({ searchParams }: PageProps<"/learners">) {
  const session = await requirePermission("learners.view");
  const sp = await searchParams;
  const page = num(sp.page) ?? 1;
  const sort = oneOf(sp.sort, LEARNER_SORTS) ?? "newest";
  const filters = {
    q: text(sp.q),
    collegeId: num(sp.college),
    year: num(sp.year),
    ownerId: num(sp.owner),
    enrolment: oneOf(sp.status, ["enrolled", "not"] as const),
    from: isoDate(sp.from),
    to: isoDate(sp.to),
    sort,
  };
  const [options, { rows, total }] = await Promise.all([getOptions(), listLearners(session, filters, page, PAGE_SIZE)]);
  const manage = session.can("learners.manage");

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "page" && k !== "saved" && typeof v === "string" && v) query.set(k, v);

  const chips = buildChips("/learners", sp, [
    { key: "q", label: "Search", value: filters.q },
    { key: "college", label: "College", value: options.colleges.find((c) => c.id === filters.collegeId)?.name },
    { key: "year", label: "Year", value: filters.year ? yearLabel(filters.year) : undefined },
    { key: "owner", label: "Counsellor", value: options.counsellors.find((u) => u.id === filters.ownerId)?.name },
    { key: "status", label: "Status", value: filters.enrolment === "enrolled" ? "Enrolled" : filters.enrolment === "not" ? "Not enrolled yet" : undefined },
    { key: "from", label: "Added from", value: filters.from },
    { key: "to", label: "Added to", value: filters.to },
  ]);

  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader
        title="Learners"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Learners" }]}
        actions={
          <>
            {session.can("leads.import") && <ButtonLink href="/learners/import" variant="secondary">Import</ButtonLink>}
            {session.can("learners.view") && <ButtonLink href="/api/export/learners?format=xlsx" variant="secondary" prefetch={false}>Export</ButtonLink>}
            {manage && <ButtonLink href="/learners/new"><Plus size={16} aria-hidden /> Add learner</ButtonLink>}
          </>
        }
      />
      <LearnersTabs active="learners" />

      <Card className="p-0">
        <FilterBar
          basePath="/learners"
          search={{ value: filters.q, placeholder: "Search name, phone, email, college, branch…" }}
          sort={{ value: sort, options: [{ value: "newest", label: "Newest added" }, { value: "oldest", label: "Oldest added" }, { value: "name_asc", label: "Name A to Z" }, { value: "name_desc", label: "Name Z to A" }] }}
          chips={chips}
        >
          <FilterField label="College">
            <Select name="college" defaultValue={sp.college as string} className="w-full">
              <option value="">All colleges</option>
              {options.colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Year">
            <Select name="year" defaultValue={sp.year as string} className="w-full">
              <option value="">Any year</option>
              {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Enrolment">
            <Select name="status" defaultValue={sp.status as string} className="w-full">
              <option value="">Enrolled or not</option>
              <option value="enrolled">Enrolled</option>
              <option value="not">Not enrolled yet</option>
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
          <FilterField label="Added from"><Input name="from" type="date" defaultValue={filters.from} className="w-full" /></FilterField>
          <FilterField label="Added to"><Input name="to" type="date" defaultValue={filters.to} className="w-full" /></FilterField>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            title={chips.length ? "No learners match these filters" : "No learners yet"}
            hint={chips.length ? "Try removing a filter." : "Import your collected students from a spreadsheet, or add one by hand."}
            action={!chips.length && session.can("leads.import") ? <ButtonLink href="/learners/import">Import learners</ButtonLink> : undefined}
          />
        ) : (
          <div className="px-1 pb-3 md:px-2">
            <Table>
              <thead>
                <tr><Th className="w-12">Sr</Th><Th>Learner</Th><Th>College · Branch</Th>{session.user.viewScope === "all" && <Th>Counsellor</Th>}<Th>Status</Th><Th className="text-right">Actions</Th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={r.enrolled > 0 ? "hover:bg-muted/50" : "bg-brand-tint/40 hover:bg-brand-tint"}>
                    <Td className="tabular-nums text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</Td>
                    <Td>
                      <QuickLook
                        data={{
                          id: r.id, name: r.name, phone: r.phones[0], email: r.emails[0], college: r.college, branch: r.branch,
                          year: r.year ? yearLabel(r.year) : null, city: r.city, owner: r.owner, added: formatDate(r.createdAt),
                          badge: <EnrolmentBadge enrolled={r.enrolled} open={r.openEnquiries} lost={r.lostEnquiries} total={r.enquiries} />,
                          stats: [{ label: "Enquiries", value: String(r.enquiries) }, { label: "Enrolled", value: String(r.enrolled) }, { label: "Open", value: String(r.openEnquiries) }],
                          canCreateEnquiry: session.can("leads.create"),
                        }}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{niceName(r.name)}</p>
                          <p className="truncate text-xs tabular-nums text-muted-foreground">{[r.phones[0], r.emails[0]].filter(Boolean).join(" · ") || "No contact"}</p>
                        </div>
                      </QuickLook>
                    </Td>
                    <Td>
                      {r.college || r.branch ? (
                        <>
                          <p className="max-w-60 truncate">{r.college ?? <Blank />}</p>
                          <p className="max-w-60 truncate text-xs text-muted-foreground">{[r.branch, r.year ? yearLabel(r.year) : null].filter(Boolean).join(" · ")}</p>
                        </>
                      ) : <Blank />}
                    </Td>
                    {session.user.viewScope === "all" && <Td>{r.owner ?? <Blank />}</Td>}
                    <Td><EnrolmentBadge enrolled={r.enrolled} open={r.openEnquiries} lost={r.lostEnquiries} total={r.enquiries} /></Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {session.can("leads.create") && <ButtonLink href={`/leads/new?learner=${r.id}`} variant="secondary" size="sm">Create enquiry</ButtonLink>}
                        <ButtonLink href={`/learners/${r.id}`} variant="ghost" size="icon" aria-label={`View ${r.name}`}><Eye size={16} /></ButtonLink>
                        {manage && <ButtonLink href={`/learners/${r.id}/edit`} variant="ghost" size="icon" aria-label={`Edit ${r.name}`}><Pencil size={16} /></ButtonLink>}
                        {manage && (
                          <form action={deleteLearnerAction.bind(null, r.id)}>
                            <ConfirmButton message={`Delete ${r.name} and all their enquiries? This cannot be undone.`} variant="ghost" size="icon" aria-label={`Delete ${r.name}`}><Trash2 size={16} /></ConfirmButton>
                          </form>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/learners?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) })}`} />
          </div>
        )}
      </Card>
    </>
  );
}
