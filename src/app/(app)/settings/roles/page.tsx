import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { asc, sql } from "drizzle-orm";
import { Plus, Trash2 } from "lucide-react";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Badge, Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Table, Td, Th } from "@/components/ui/page";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { deleteRoleAction } from "../actions";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  await requirePermission("settings.roles");
  const rows = await db
    .select({ id: roles.id, name: roles.name, description: roles.description, type: roles.permissionType, scope: roles.viewScope, count: roles.permissions, members: sql<number>`(select count(*)::int from ${users} where ${users.roleId} = ${roles.id})` })
    .from(roles)
    .orderBy(asc(roles.name));
  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader title="Roles & permissions" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Roles" }]} actions={<ButtonLink href="/settings/roles/new"><Plus size={16} aria-hidden /> Add role</ButtonLink>} />
      <Card className="p-0">
        <div className="px-1 pb-2 md:px-2">
          <Table>
            <thead><tr><Th>Role</Th><Th>Access</Th><Th>Sees</Th><Th className="text-right">Users</Th><Th className="text-right">Actions</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link href={`/settings/roles/${r.id}/edit`} className="font-semibold text-brand hover:underline">{r.name}</Link>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  </Td>
                  <Td>{r.type === "all" ? <Badge tone="brand">Full access</Badge> : <Badge tone="neutral">{r.count.length} permissions</Badge>}</Td>
                  <Td>{r.scope === "own" ? "Only their own" : "Everyone's"}</Td>
                  <Td className="text-right tabular-nums">{r.members}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <form action={deleteRoleAction.bind(null, r.id)}>
                        <ConfirmButton message={`Delete the role ${r.name}?`} variant="ghost" size="icon" aria-label={`Delete ${r.name}`} disabled={r.members > 0}><Trash2 size={16} /></ConfirmButton>
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </>
  );
}
