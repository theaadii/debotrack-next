import { parseId } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { programs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { ProgramFields } from "@/components/programs/forms";
import { saveProgramAction } from "../../actions";

export const metadata: Metadata = { title: "Edit program" };

export default async function EditProgramPage({ params }: PageProps<"/programs/[id]/edit">) {
  await requirePermission("programs.manage");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [p] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
  if (!p) notFound();
  return (
    <>
      <PageHeader title={`Edit · ${p.name}`} crumbs={[{ label: "Programs", href: "/programs" }, { label: p.name }]} />
      <Card className="max-w-2xl"><ActionForm action={saveProgramAction.bind(null, id)} submitLabel="Save changes" cancelHref="/programs"><ProgramFields d={p} /></ActionForm></Card>
    </>
  );
}
