import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { LearnerFields } from "@/components/learners/learner-fields";
import { createLearnerAction } from "../actions";

export const metadata: Metadata = { title: "Add learner" };

export default async function NewLearnerPage() {
  const session = await requirePermission("learners.manage");
  const options = await getOptions();
  return (
    <>
      <PageHeader title="Add learner" crumbs={[{ label: "Learners", href: "/learners" }, { label: "Add" }]} />
      <Card className="max-w-3xl">
        <ActionForm action={createLearnerAction} submitLabel="Save learner" cancelHref="/learners">
          <LearnerFields colleges={options.colleges} counsellors={session.user.viewScope === "all" ? options.counsellors : undefined} />
        </ActionForm>
      </Card>
    </>
  );
}
