import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/db";
import { colleges, connections } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Badge, Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { deleteConnectionAction } from "./actions";

export const metadata: Metadata = { title: "Connections" };

const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export default async function ConnectionsPage({ searchParams }: PageProps<"/connections">) {
  const session = await requirePermission("connections.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const like = q ? `%${esc(q)}%` : null;

  const rows = await db
    .select({ id: connections.id, name: connections.name, designation: connections.designation, phone: connections.phone, email: connections.email, notes: connections.notes, institution: colleges.name })
    .from(connections)
    .leftJoin(colleges, eq(colleges.id, connections.collegeId))
    .where(like ? and(or(ilike(connections.name, like), ilike(connections.designation, like), ilike(colleges.name, like), ilike(connections.phone, like), ilike(connections.email, like))) : undefined)
    .orderBy(asc(colleges.name), asc(connections.name));

  const manage = session.can("connections.manage");
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.institution ?? "No institution", [...(groups.get(r.institution ?? "No institution") ?? []), r]);

  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader
        title="Connections"
        subtitle="The people we know at schools and colleges: HODs, principals, TPOs."
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Connections" }]}
        actions={
          <>
            {manage && <ButtonLink href="/connections/import" variant="secondary">Import</ButtonLink>}
            <ButtonLink href="/api/export/connections" variant="secondary" prefetch={false}>Export</ButtonLink>
            {manage && <ButtonLink href="/connections/new"><Plus size={16} aria-hidden /> Add connection</ButtonLink>}
          </>
        }
      />
      <form className="mb-4 flex gap-2" role="search">
        <Input name="q" type="search" placeholder="Search name, designation, college, phone…" defaultValue={q} aria-label="Search" className="max-w-md" />
        <Button type="submit">Search</Button>
        {q && <ButtonLink href="/connections" variant="ghost">Clear</ButtonLink>}
      </form>

      {rows.length === 0 ? (
        <Card><EmptyState title={q ? "No connections match" : "No connections yet"} hint="Add the HODs, principals and TPOs you know, grouped by their institution." action={manage && !q ? <ButtonLink href="/connections/new">Add connection</ButtonLink> : undefined} /></Card>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([institution, people]) => (
            <Card key={institution} className="p-0">
              <h2 className="border-b border-border px-4 py-3 text-sm font-bold">{institution} <span className="font-normal text-muted-foreground">· {people.length}</span></h2>
              <ul className="divide-y divide-border">
                {people.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {manage ? <Link href={`/connections/${p.id}/edit`} className="font-semibold text-brand hover:underline">{p.name}</Link> : <span className="font-semibold">{p.name}</span>}
                        {p.designation && <Badge tone="neutral">{p.designation}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.phone && <a href={`tel:${p.phone}`} className="mr-3 hover:underline">{p.phone}</a>}
                        {p.email && <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a>}
                      </p>
                      {p.notes && <p className="mt-0.5 text-xs text-muted-foreground">{p.notes}</p>}
                    </div>
                    {manage && (
                      <div className="flex items-center gap-1">
                        <ButtonLink href={`/connections/${p.id}/edit`} variant="ghost" size="icon" aria-label={`Edit ${p.name}`}><Pencil size={16} /></ButtonLink>
                        <form action={deleteConnectionAction.bind(null, p.id)}>
                          <ConfirmButton message={`Delete ${p.name}?`} variant="ghost" size="icon" aria-label={`Delete ${p.name}`}><Trash2 size={16} /></ConfirmButton>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
