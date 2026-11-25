import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/db";
import { batches, programs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Badge, Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/page";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { formatDate, formatMoney } from "@/lib/utils";
import { deleteBatchAction, deleteProgramAction } from "./actions";
import { Blank } from "@/components/ui/blank";

export const metadata: Metadata = { title: "Programs" };

export default async function ProgramsPage() {
  const session = await requirePermission("programs.view");
  const [progs, bats] = await Promise.all([
    db.select().from(programs).orderBy(asc(programs.name)),
    db.select().from(batches).orderBy(asc(batches.startDate), asc(batches.name)),
  ]);
  const manage = session.can("programs.manage");

  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader
        title="Programs & Batches"
        subtitle="The courses you offer, and each run of them with its start date and fee."
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Programs" }]}
        actions={manage ? <><ButtonLink href="/programs/batches/new" variant="secondary"><Plus size={16} aria-hidden /> Add batch</ButtonLink><ButtonLink href="/programs/new"><Plus size={16} aria-hidden /> Add program</ButtonLink></> : undefined}
      />
      {progs.length === 0 ? (
        <Card><EmptyState title="No programs yet" hint="Add your first program, then a batch with its fee. Enquiries pick their fee from the batch." action={manage ? <ButtonLink href="/programs/new">Add program</ButtonLink> : undefined} /></Card>
      ) : (
        <div className="space-y-4">
          {progs.map((p) => {
            const mine = bats.filter((b) => b.programId === p.id);
            return (
              <Card key={p.id} className="p-0">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {manage ? <Link href={`/programs/${p.id}/edit`}><CardTitle className="text-brand hover:underline">{p.name}</CardTitle></Link> : <CardTitle>{p.name}</CardTitle>}
                      {!p.active && <Badge tone="muted">Inactive</Badge>}
                    </div>
                    {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                  </div>
                  {manage && (
                    <div className="flex items-center gap-1">
                      <ButtonLink href={`/programs/batches/new?program=${p.id}`} variant="secondary" size="sm">Add batch</ButtonLink>
                      <ButtonLink href={`/programs/${p.id}/edit`} variant="ghost" size="icon" aria-label={`Edit ${p.name}`}><Pencil size={16} /></ButtonLink>
                      <form action={deleteProgramAction.bind(null, p.id)}>
                        <ConfirmButton message={`Delete ${p.name} and its ${mine.length} batch(es)? Enquiries keep their saved fee.`} variant="ghost" size="icon" aria-label={`Delete ${p.name}`}><Trash2 size={16} /></ConfirmButton>
                      </form>
                    </div>
                  )}
                </div>
                {mine.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No batches yet.</p>
                ) : (
                  <div className="px-1 pb-2 md:px-2">
                    <Table>
                      <thead><tr><Th>Batch</Th><Th>Starts</Th><Th className="text-right">Fee</Th><Th className="text-right">Seats</Th><Th>Status</Th>{manage && <Th className="text-right">Actions</Th>}</tr></thead>
                      <tbody>
                        {mine.map((b) => (
                          <tr key={b.id}>
                            <Td>{manage ? <Link href={`/programs/batches/${b.id}/edit`} className="font-semibold text-brand hover:underline">{b.name}</Link> : <span className="font-semibold">{b.name}</span>}</Td>
                            <Td>{b.startDate ? formatDate(b.startDate) : <Blank />}</Td>
                            <Td className="text-right tabular-nums">{formatMoney(b.fee)}</Td>
                            <Td className="text-right tabular-nums">{b.seats ?? <Blank />}</Td>
                            <Td>{b.active ? <Badge tone="brand">Open</Badge> : <Badge tone="muted">Closed</Badge>}</Td>
                            {manage && (
                              <Td>
                                <div className="flex items-center justify-end gap-1">
                                  <ButtonLink href={`/programs/batches/${b.id}/edit`} variant="ghost" size="icon" aria-label={`Edit ${b.name}`}><Pencil size={16} /></ButtonLink>
                                  <form action={deleteBatchAction.bind(null, b.id)}>
                                    <ConfirmButton message={`Delete the batch ${b.name}?`} variant="ghost" size="icon" aria-label={`Delete ${b.name}`}><Trash2 size={16} /></ConfirmButton>
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
            );
          })}
        </div>
      )}
    </>
  );
}
