import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { programs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { BatchFields } from "@/components/programs/forms";
import { saveBatchAction } from "../../actions";

export const metadata: Metadata = { title: "Add batch" };

export default async function NewBatchPage({ searchParams }: PageProps<"/programs/batches/new">) {
  await requirePermission("programs.manage");
  const progs = await db.select({ id: programs.id, name: programs.name }).from(programs).orderBy(asc(programs.name));
  const pre = (await searchParams).program;
  return (
    <>
      <PageHeader title="Add batch" crumbs={[{ label: "Programs", href: "/programs" }, { label: "Add batch" }]} />
      <Card className="max-w-2xl"><ActionForm action={saveBatchAction.bind(null, null)} submitLabel="Save batch" cancelHref="/programs"><BatchFields programs={progs} d={{ program_id: typeof pre === "string" ? pre : undefined }} /></ActionForm></Card>
    </>
  );
}
