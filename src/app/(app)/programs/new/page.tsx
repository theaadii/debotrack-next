import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { ProgramFields } from "@/components/programs/forms";
import { saveProgramAction } from "../actions";

export const metadata: Metadata = { title: "Add program" };

export default async function NewProgramPage() {
  await requirePermission("programs.manage");
  return (
    <>
      <PageHeader title="Add program" crumbs={[{ label: "Programs", href: "/programs" }, { label: "Add" }]} />
      <Card className="max-w-2xl"><ActionForm action={saveProgramAction.bind(null, null)} submitLabel="Save program" cancelHref="/programs"><ProgramFields /></ActionForm></Card>
    </>
  );
}
