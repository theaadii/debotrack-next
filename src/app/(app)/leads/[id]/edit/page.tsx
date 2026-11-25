import { parseId } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getLead } from "@/server/leads";
import { getOptions } from "@/server/options";
import { PageHeader } from "@/components/ui/page";
import { LeadForm, type LeadFormValues } from "@/components/leads/lead-form";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateLeadAction } from "../../actions";

export const metadata: Metadata = { title: "Edit enquiry" };

export default async function EditLeadPage({ params }: PageProps<"/leads/[id]/edit">) {
  const session = await requirePermission("leads.edit");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const lead = await getLead(session, id);
  if (!lead) notFound();
  const options = await getOptions();
  const [raw] = await db.select({ programId: leads.programId, batchId: leads.batchId, sourceId: leads.sourceId, typeId: leads.typeId }).from(leads).where(eq(leads.id, id)).limit(1);

  const initial: LeadFormValues = {
    name: lead.learner, phone: lead.phones.join(", "), email: lead.emails.join(", "), college: lead.college ?? "", branch: lead.branch ?? "",
    year: lead.year ? String(lead.year) : "", city: lead.city ?? "", qualification: lead.qualification ?? "",
    source_id: raw?.sourceId ? String(raw.sourceId) : "", type_id: raw?.typeId ? String(raw.typeId) : "", owner_id: lead.ownerId ? String(lead.ownerId) : "",
    expected_close_date: lead.expectedCloseDate ?? "", program_id: raw?.programId ? String(raw.programId) : "", batch_id: raw?.batchId ? String(raw.batchId) : "",
    discount_type: lead.discountType ?? "", discount_value: lead.discountValue ? String(Number(lead.discountValue)) : "", remarks: lead.remarks ?? "",
  };

  return (
    <>
      <PageHeader title={`Edit · ${lead.learner}`} crumbs={[{ label: "Enquiries", href: "/leads" }, { label: lead.learner, href: `/leads/${id}` }, { label: "Edit" }]} />
      <LeadForm learnerId={lead.learnerId} action={updateLeadAction.bind(null, id)} options={options} initial={initial} canPickOwner={session.user.viewScope === "all"} submitLabel="Save changes" cancelHref={`/leads/${id}`} />
    </>
  );
}
