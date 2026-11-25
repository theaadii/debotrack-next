import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page";
import { ImportForm } from "@/components/import/import-form";
import { importConnectionsAction } from "@/app/import-actions";

export const metadata: Metadata = { title: "Import connections" };

export default async function ImportConnectionsPage() {
  await requirePermission("connections.manage");
  return (
    <>
      <PageHeader title="Import connections" crumbs={[{ label: "Connections", href: "/connections" }, { label: "Import" }]} />
      <ImportForm action={importConnectionsAction} mode="connections" sources={[]} counsellors={[]} colleges={[]} canAssign={false} />
    </>
  );
}
