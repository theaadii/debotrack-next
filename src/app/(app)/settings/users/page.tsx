import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Badge, Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Table, Td, Th } from "@/components/ui/page";
import { Flash } from "@/components/flash";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requirePermission("settings.users");
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, active: users.active, lastLoginAt: users.lastLoginAt, role: roles.name })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .orderBy(asc(users.name));
  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader title="Users" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Users" }]} actions={<ButtonLink href="/settings/users/new"><Plus size={16} aria-hidden /> Add user</ButtonLink>} />
      <Card className="p-0">
        <div className="px-1 pb-2 md:px-2">
          <Table>
            <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Last sign-in</Th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <Td><Link href={`/settings/users/${u.id}/edit`} className="font-semibold text-brand hover:underline">{u.name}</Link></Td>
                  <Td>{u.email}</Td>
                  <Td>{u.role}</Td>
                  <Td>{u.active ? <Badge tone="brand">Active</Badge> : <Badge tone="muted">Disabled</Badge>}</Td>
                  <Td>{formatDateTime(u.lastLoginAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </>
  );
}
