import { parseId } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { RoleFields } from "@/components/settings/role-fields";
import { saveRoleAction } from "../../../actions";

export const metadata: Metadata = { title: "Edit role" };

export default async function EditRolePage({ params }: PageProps<"/settings/roles/[id]/edit">) {
  await requirePermission("settings.roles");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [r] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!r) notFound();
  return (
    <>
      <PageHeader title={`Edit · ${r.name}`} crumbs={[{ label: "Settings", href: "/settings" }, { label: "Roles", href: "/settings/roles" }, { label: r.name }]} />
      <Card className="max-w-3xl"><ActionForm action={saveRoleAction.bind(null, id)} submitLabel="Save changes" cancelHref="/settings/roles"><RoleFields d={r} /></ActionForm></Card>
    </>
  );
}
