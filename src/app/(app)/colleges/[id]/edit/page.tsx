import { parseId } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { collegeAliases, colleges } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm, AreaField, FormGrid, TextField } from "@/components/forms";
import { updateCollegeAction } from "../../../learners/actions";

export const metadata: Metadata = { title: "Edit college" };

export default async function EditCollegePage({ params }: PageProps<"/colleges/[id]/edit">) {
  await requirePermission("learners.manage");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [c] = await db.select().from(colleges).where(eq(colleges.id, id)).limit(1);
  if (!c) notFound();
  const aliases = (await db.select({ alias: collegeAliases.alias }).from(collegeAliases).where(eq(collegeAliases.collegeId, id)).orderBy(collegeAliases.alias)).map((a) => a.alias).join("\n");
  return (
    <>
      <PageHeader title={`Edit · ${c.name}`} crumbs={[{ label: "Learners", href: "/learners" }, { label: "Schools & Colleges", href: "/colleges" }, { label: c.name }]} />
      <Card className="max-w-2xl">
        <ActionForm action={updateCollegeAction.bind(null, id)} submitLabel="Save changes" cancelHref="/colleges">
          <FormGrid>
            <TextField name="name" label="Name" required defaultValue={c.name} className="md:col-span-2" />
            <AreaField name="aliases" label="Also known as" className="md:col-span-2" hint="Other spellings, one per line (for example MET IOE, MET BKC). Imports using any of them go to this college." defaultValue={aliases} rows={3} />
            <TextField name="city" label="City" defaultValue={c.city} />
            <TextField name="website" label="Website" type="url" defaultValue={c.website} placeholder="https://" />
          </FormGrid>
        </ActionForm>
      </Card>
    </>
  );
}
