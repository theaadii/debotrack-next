import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { PageHeader } from "@/components/ui/page";
import { ImportForm } from "@/components/import/import-form";
import { importAction } from "@/app/import-actions";

export const metadata: Metadata = { title: "Import enquiries" };

export default async function ImportLeadsPage() {
  const session = await requirePermission("leads.import");
  const o = await getOptions();
  return (
    <>
      <PageHeader title="Import enquiries" subtitle="Each row becomes an enquiry; learners already saved are matched by phone or email." crumbs={[{ label: "Enquiries", href: "/leads" }, { label: "Import" }]} />
      <ImportForm action={importAction} mode="leads" sources={o.sources} counsellors={o.counsellors} colleges={o.colleges} canAssign={session.user.viewScope === "all"} />
    </>
  );
}
