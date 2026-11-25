import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { colleges, learners } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { learnerScope } from "@/server/scope";
import { PageHeader } from "@/components/ui/page";
import { LeadForm, type LeadFormValues } from "@/components/leads/lead-form";
import { createLeadAction } from "../actions";

export const metadata: Metadata = { title: "Create enquiry" };

export default async function NewLeadPage({ searchParams }: PageProps<"/leads/new">) {
  const session = await requirePermission("leads.create");
  const options = await getOptions();
  const learnerId = Number((await searchParams).learner);

  // "Create enquiry" from a learner's profile: start with that learner's details filled in.
  let initial: LeadFormValues = {};
  let linked = false;
  if (Number.isInteger(learnerId) && learnerId > 0) {
    const [l] = await db
      .select({ l: learners, college: colleges.name })
      .from(learners)
      .leftJoin(colleges, eq(colleges.id, learners.collegeId))
      .where(and(eq(learners.id, learnerId), learnerScope(session)))
      .limit(1);
    if (l) {
      linked = true;
      initial = {
        learner_id: String(l.l.id), name: l.l.name, phone: l.l.phones.join(", "), email: l.l.emails.join(", "), college: l.college ?? "",
        branch: l.l.branch ?? "", year: l.l.year ? String(l.l.year) : "", city: l.l.city ?? "", qualification: l.l.qualification ?? "",
      };
    }
  }

  return (
    <>
      <PageHeader title="Create enquiry" crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Enquiries", href: "/leads" }, { label: "Create" }]} />
      <LeadForm action={createLeadAction} options={options} initial={initial} linkedLearner={linked} canPickOwner={session.user.viewScope === "all"} submitLabel="Save enquiry" cancelHref="/leads" />
    </>
  );
}
