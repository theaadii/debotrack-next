import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { UserFields } from "@/components/settings/user-fields";
import { saveUserAction } from "../../actions";

export const metadata: Metadata = { title: "Add user" };

export default async function NewUserPage() {
  await requirePermission("settings.users");
  const rs = await db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(asc(roles.name));
  return (
    <>
      <PageHeader title="Add user" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Users", href: "/settings/users" }, { label: "Add" }]} />
      <Card className="max-w-3xl"><ActionForm action={saveUserAction.bind(null, null)} submitLabel="Create user" cancelHref="/settings/users"><UserFields roles={rs} /></ActionForm></Card>
    </>
  );
}
