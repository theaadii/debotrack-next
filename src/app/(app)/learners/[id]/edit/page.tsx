import { parseId } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { getLearner } from "@/server/learners";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { LearnerFields } from "@/components/learners/learner-fields";
import { updateLearnerAction } from "../../actions";

export const metadata: Metadata = { title: "Edit learner" };

export default async function EditLearnerPage({ params }: PageProps<"/learners/[id]/edit">) {
  const session = await requirePermission("learners.manage");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [learner, options] = await Promise.all([getLearner(session, id), getOptions()]);
  if (!learner) notFound();

  return (
    <>
      <PageHeader title={`Edit · ${learner.name}`} crumbs={[{ label: "Learners", href: "/learners" }, { label: learner.name, href: `/learners/${id}` }, { label: "Edit" }]} />
      <Card className="max-w-3xl">
        <ActionForm action={updateLearnerAction.bind(null, id)} submitLabel="Save changes" cancelHref={`/learners/${id}`}>
          <LearnerFields editingId={id}
            colleges={options.colleges}
            counsellors={session.user.viewScope === "all" ? options.counsellors : undefined}
            d={{ name: learner.name, phone: learner.phones.join(", "), email: learner.emails.join(", "), college: learner.college ?? "", branch: learner.branch ?? "", year: learner.year ? String(learner.year) : "", city: learner.city ?? "", qualification: learner.qualification ?? "", kind: learner.kind, owner_id: learner.ownerId ? String(learner.ownerId) : "" }}
          />
        </ActionForm>
      </Card>
    </>
  );
}
