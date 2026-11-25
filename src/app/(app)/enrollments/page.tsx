import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { listLeads } from "@/server/leads";
import { getOptions } from "@/server/options";
import { FilterBar, FilterField, buildChips } from "@/components/filters/filter-bar";
import { isoDate, num, oneOf, text } from "@/lib/list-params";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Eye } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/page";
import { QuickLook } from "@/components/quick-look";
import { StageBadge } from "@/components/stage-badge";
import { Blank } from "@/components/ui/blank";
import { formatDate, formatMoney, niceName, yearLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Enrollments" };
const PAGE_SIZE = 25;

/** Learners who converted: enquiries that reached an "enrolled" (won) status. */
export default async function EnrollmentsPage({ searchParams }: PageProps<"/enrollments">) {
  const session = await requirePermission("leads.view");
  const sp = await searchParams;
  const page = num(sp.page) ?? 1;
  const q = text(sp.q);
  const sort = oneOf(sp.sort, ["enrolled_new", "enrolled_old", "fee_desc", "fee_asc", "name"] as const) ?? "enrolled_new";
  const filters = { q, stageKind: "won" as const, programId: num(sp.program), ownerId: num(sp.owner), collegeId: num(sp.college), enrolledFrom: isoDate(sp.from), enrolledTo: isoDate(sp.to), sort };
  const [options, { rows, total }] = await Promise.all([getOptions(), listLeads(session, filters, page, PAGE_SIZE)]);
  const revenue = rows.reduce((sum, r) => sum + Number(r.finalFee ?? r.courseFee ?? 0), 0);
  const chips = buildChips("/enrollments", sp, [
    { key: "q", label: "Search", value: q },
    { key: "program", label: "Program", value: options.programs.find((x) => x.id === filters.programId)?.name },
    { key: "college", label: "College", value: options.colleges.find((x) => x.id === filters.collegeId)?.name },
    { key: "owner", label: "Counsellor", value: options.counsellors.find((x) => x.id === filters.ownerId)?.name },
    { key: "from", label: "Enrolled from", value: filters.enrolledFrom },
    { key: "to", label: "Enrolled to", value: filters.enrolledTo },
  ]);
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "page" && typeof v === "string" && v) query.set(k, v);

  return (
    <>
      <PageHeader
        title="Enrollments"
        subtitle="Learners who converted: learner → enquiry → enrolled."
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Enrollments" }]}
      />
      <Card className="p-0">
        <FilterBar
          basePath="/enrollments"
          search={{ value: q, placeholder: "Search name, phone, email, college…" }}
          sort={{ value: sort, options: [{ value: "enrolled_new", label: "Recently enrolled" }, { value: "enrolled_old", label: "Earliest enrolled" }, { value: "fee_desc", label: "Fee: high to low" }, { value: "fee_asc", label: "Fee: low to high" }, { value: "name", label: "Name A to Z" }] }}
          chips={chips}
          extra={
            <p className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
              <span><b className="text-foreground">{total}</b> enrolled</span>
              {rows.length > 0 && <span className="hidden md:inline">Fees on this page: <b className="tabular-nums text-foreground">{formatMoney(revenue)}</b></span>}
            </p>
          }
        >
          <FilterField label="Program">
            <Select name="program" defaultValue={sp.program as string} className="w-full">
              <option value="">All programs</option>
              {options.programs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
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
          <FilterField label="Enrolled from"><Input name="from" type="date" defaultValue={filters.enrolledFrom} className="w-full" /></FilterField>
          <FilterField label="Enrolled to"><Input name="to" type="date" defaultValue={filters.enrolledTo} className="w-full" /></FilterField>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            title={chips.length ? "No enrollments match these filters" : "No enrollments yet"}
            hint={chips.length ? "Try removing a filter." : "When an enquiry is moved to the enrolled status, the learner shows up here."}
            action={!chips.length ? <ButtonLink href="/leads">Go to enquiries</ButtonLink> : undefined}
          />
        ) : (
          <div className="px-1 pb-3 md:px-2">
            <Table>
              <thead>
                <tr><Th className="w-12">Sr</Th><Th>Learner</Th><Th>Program · Batch</Th><Th className="text-right">Final fee</Th><Th>Enrolled on</Th><Th>Counsellor</Th><Th className="text-right">Actions</Th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}><Td className="tabular-nums text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</Td>
                    <Td>
                      <QuickLook
                        data={{
                          id: r.learnerId, name: r.learner, phone: r.phones[0], email: r.emails[0], college: r.college, branch: r.branch,
                          year: r.year ? yearLabel(r.year) : null, city: r.city, owner: r.owner,
                          badge: <StageBadge name={r.stage} kind={r.stageKind} />,
                          stats: [{ label: "Final fee", value: formatMoney(r.finalFee ?? r.courseFee) }],
                          canCreateEnquiry: false,
                        }}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{niceName(r.learner)}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">{[r.phones[0], r.college].filter(Boolean).join(" · ")}</p>
                        </div>
                      </QuickLook>
                    </Td>
                    <Td>{r.program ? <>{r.program}{r.batch && <span className="text-muted-foreground"> · {r.batch}</span>}</> : <Blank />}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(r.finalFee ?? r.courseFee)}</Td>
                    <Td>{formatDate(r.closedAt)}</Td>
                    <Td>{r.owner ?? <Blank />}</Td>
                    <Td><div className="flex justify-end"><ButtonLink href={`/leads/${r.id}`} variant="ghost" size="icon" aria-label={`View ${r.learner}`}><Eye size={16} /></ButtonLink></div></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/enrollments?${new URLSearchParams({ ...Object.fromEntries(query), page: String(p) })}`} />
          </div>
        )}
      </Card>
    </>
  );
}
