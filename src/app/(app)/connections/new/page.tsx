import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { ConnectionFields } from "@/components/connections/fields";
import { saveConnectionAction } from "../actions";

export const metadata: Metadata = { title: "Add connection" };

export default async function NewConnectionPage() {
  await requirePermission("connections.manage");
  const options = await getOptions();
  return (
    <>
      <PageHeader title="Add connection" crumbs={[{ label: "Connections", href: "/connections" }, { label: "Add" }]} />
      <Card className="max-w-3xl"><ActionForm action={saveConnectionAction.bind(null, null)} submitLabel="Save connection" cancelHref="/connections"><ConnectionFields colleges={options.colleges} /></ActionForm></Card>
    </>
  );
}
