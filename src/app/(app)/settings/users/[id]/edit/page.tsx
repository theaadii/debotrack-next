import { parseId } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { roles, users } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { UserFields } from "@/components/settings/user-fields";
import { saveUserAction } from "../../../actions";

export const metadata: Metadata = { title: "Edit user" };

export default async function EditUserPage({ params }: PageProps<"/settings/users/[id]/edit">) {
  await requirePermission("settings.users");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [[u], rs] = await Promise.all([db.select().from(users).where(eq(users.id, id)).limit(1), db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(asc(roles.name))]);
  if (!u) notFound();
  return (
    <>
      <PageHeader title={`Edit · ${u.name}`} crumbs={[{ label: "Settings", href: "/settings" }, { label: "Users", href: "/settings/users" }, { label: u.name }]} />
      <Card className="max-w-3xl">
        <ActionForm action={saveUserAction.bind(null, id)} submitLabel="Save changes" cancelHref="/settings/users">
          <UserFields editing roles={rs} d={{ name: u.name, email: u.email, role_id: String(u.roleId), active: u.active }} />
        </ActionForm>
      </Card>
    </>
  );
}
