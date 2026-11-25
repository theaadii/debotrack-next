import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { listColleges } from "@/server/learners";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/page";
import { LearnersTabs } from "@/components/learners-tabs";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { deleteCollegeAction } from "../learners/actions";
import { Blank } from "@/components/ui/blank";

export const metadata: Metadata = { title: "Schools & Colleges" };

export default async function CollegesPage({ searchParams }: PageProps<"/colleges">) {
  const session = await requirePermission("learners.view");
  const q = (await searchParams).q;
  const rows = await listColleges(typeof q === "string" ? q : undefined);
  const manage = session.can("learners.manage");

  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader
        title="Schools & Colleges"
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Learners", href: "/learners" }, { label: "Schools & Colleges" }]}
        actions={manage ? <ButtonLink href="/colleges/new"><Plus size={16} aria-hidden /> Add college</ButtonLink> : undefined}
      />
      <LearnersTabs active="colleges" />
      <Card className="p-0">
        <form className="flex gap-2 border-b border-border p-3 md:p-4" role="search">
          <Input name="q" type="search" placeholder="Search name or city…" defaultValue={typeof q === "string" ? q : ""} aria-label="Search" />
          <Button type="submit">Search</Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState title="No schools or colleges yet" hint="They are added automatically when you import learners or create enquiries, or you can add one here." />
        ) : (
          <div className="px-1 pb-3 md:px-2">
            <Table>
              <thead><tr><Th>Name</Th><Th>City</Th><Th>Website</Th><Th className="text-right">Learners</Th>{manage && <Th className="text-right">Actions</Th>}</tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50">
                    <Td>
                      {manage ? <Link href={`/colleges/${c.id}/edit`} className="font-semibold text-brand hover:underline">{c.name}</Link> : <span className="font-semibold">{c.name}</span>}
                    </Td>
                    <Td>{c.city ?? <Blank />}</Td>
                    <Td>{c.website ?? <Blank />}</Td>
                    <Td className="text-right tabular-nums"><Link href={`/learners?college=${c.id}`} className="hover:underline">{c.learners}</Link></Td>
                    {manage && (
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <ButtonLink href={`/colleges/${c.id}/edit`} variant="ghost" size="icon" aria-label={`Edit ${c.name}`}><Pencil size={16} /></ButtonLink>
                          <form action={deleteCollegeAction.bind(null, c.id)}>
                            <ConfirmButton message={`Delete ${c.name}? Its learners stay, but lose their college.`} variant="ghost" size="icon" aria-label={`Delete ${c.name}`}><Trash2 size={16} /></ConfirmButton>
                          </form>
                        </div>
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
