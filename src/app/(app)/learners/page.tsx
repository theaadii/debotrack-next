import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { listLearners } from "@/server/learners";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/page";
import { LearnersTabs } from "@/components/learners-tabs";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { yearLabel, niceName } from "@/lib/utils";
import { deleteLearnerAction } from "./actions";
import { Avatar } from "@/components/ui/avatar";
import { Blank } from "@/components/ui/blank";

export const metadata: Metadata = { title: "Learners" };
const PAGE_SIZE = 25;

const num = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};
const text = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function LearnersPage({ searchParams }: PageProps<"/learners">) {
  const session = await requirePermission("learners.view");
  const sp = await searchParams;
  const page = num(sp.page) ?? 1;
  const filters = { q: text(sp.q), collegeId: num(sp.college), year: num(sp.year), ownerId: num(sp.owner) };
  const [options, { rows, total }] = await Promise.all([getOptions(), listLearners(session, filters, page, PAGE_SIZE)]);
  const manage = session.can("learners.manage");

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "page" && k !== "saved" && typeof v === "string" && v) query.set(k, v);
  const filtersActive = ["q", "college", "year", "owner"].some((k) => text(sp[k]));

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
        <form className="grid items-end gap-2 border-b border-border p-3 sm:grid-cols-2 md:p-4 lg:grid-cols-4" role="search">
          <div className="sm:col-span-2">
            <label htmlFor="q" className="sr-only">Search</label>
            <Input id="q" name="q" type="search" placeholder="Search name, phone, email, college, branch…" defaultValue={filters.q} />
          </div>
          <Select name="college" defaultValue={sp.college as string} aria-label="College" className="w-full">
            <option value="">All colleges</option>
            {options.colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select name="year" defaultValue={sp.year as string} aria-label="Year" className="w-full">
            <option value="">Any year</option>
            {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
          </Select>
          {session.user.viewScope === "all" && (
            <Select name="owner" defaultValue={sp.owner as string} aria-label="Counsellor" className="w-full">
              <option value="">All counsellors</option>
              {options.counsellors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          )}
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Filter</Button>
          {filtersActive && <ButtonLink href="/learners" variant="ghost">Clear</ButtonLink>}
        
          </div>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            title={filtersActive ? "No learners match these filters" : "No learners yet"}
            hint={filtersActive ? "Try clearing a filter." : "Import your collected students from a spreadsheet, or add one by hand."}
            action={!filtersActive && session.can("leads.import") ? <ButtonLink href="/learners/import">Import learners</ButtonLink> : undefined}
          />
        ) : (
          <div className="px-1 pb-3 md:px-2">
            <Table>
              <thead>
                <tr><Th>Name</Th><Th>Phone</Th><Th>Email</Th><Th>College</Th><Th>Branch</Th><Th>Year</Th><Th>City</Th><Th>Counsellor</Th><Th className="text-right">Enquiries</Th><Th className="text-right">Actions</Th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} />
                        <Link href={`/learners/${r.id}`} className="font-semibold hover:text-brand hover:underline">{niceName(r.name)}</Link>
                      </div>
                    </Td>
                    <Td className="tabular-nums">{r.phones[0] ?? <Blank />}</Td>
                    <Td className="max-w-48 truncate">{r.emails[0] ?? <Blank />}</Td>
                    <Td>{r.college ?? <Blank />}</Td>
                    <Td>{r.branch ?? <Blank />}</Td>
                    <Td>{r.year ? yearLabel(r.year) : <Blank />}</Td>
                    <Td>{r.city ?? <Blank />}</Td>
                    <Td>{r.owner ?? <Blank />}</Td>
                    <Td className="text-right tabular-nums">{r.enquiries}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {session.can("leads.create") && <ButtonLink href={`/leads/new?learner=${r.id}`} variant="ghost" size="sm">Create enquiry</ButtonLink>}
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
