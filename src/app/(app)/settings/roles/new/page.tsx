import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { RoleFields } from "@/components/settings/role-fields";
import { saveRoleAction } from "../../actions";

export const metadata: Metadata = { title: "Add role" };

export default async function NewRolePage() {
  await requirePermission("settings.roles");
  return (
    <>
      <PageHeader title="Add role" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Roles", href: "/settings/roles" }, { label: "Add" }]} />
      <Card className="max-w-3xl"><ActionForm action={saveRoleAction.bind(null, null)} submitLabel="Save role" cancelHref="/settings/roles"><RoleFields /></ActionForm></Card>
    </>
  );
}
