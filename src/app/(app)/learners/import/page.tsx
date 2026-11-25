import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { PageHeader } from "@/components/ui/page";
import { LearnersTabs } from "@/components/learners-tabs";
import { ImportForm } from "@/components/import/import-form";
import { importAction } from "@/app/import-actions";

export const metadata: Metadata = { title: "Import learners" };

export default async function ImportLearnersPage() {
  const session = await requirePermission("leads.import");
  const o = await getOptions();
  return (
    <>
      <PageHeader title="Import learners" subtitle="Adds learners only, with no enquiry yet. Create enquiries later from each learner." crumbs={[{ label: "Learners", href: "/learners" }, { label: "Import" }]} />
      <LearnersTabs active="learners" />
      <ImportForm action={importAction} mode="learners" sources={o.sources} counsellors={o.counsellors} colleges={o.colleges} canAssign={session.user.viewScope === "all"} />
    </>
  );
}
