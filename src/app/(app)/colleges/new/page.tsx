import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm, FormGrid, TextField } from "@/components/forms";
import { createCollegeAction } from "../../learners/actions";

export const metadata: Metadata = { title: "Add college" };

export default async function NewCollegePage() {
  await requirePermission("learners.manage");
  return (
    <>
      <PageHeader title="Add school / college" crumbs={[{ label: "Learners", href: "/learners" }, { label: "Schools & Colleges", href: "/colleges" }, { label: "Add" }]} />
      <Card className="max-w-2xl">
        <ActionForm action={createCollegeAction} submitLabel="Save" cancelHref="/colleges">
          <FormGrid>
            <TextField name="name" label="Name" required className="md:col-span-2" />
            <TextField name="city" label="City" />
            <TextField name="website" label="Website" type="url" placeholder="https://" />
          </FormGrid>
        </ActionForm>
      </Card>
    </>
  );
}
