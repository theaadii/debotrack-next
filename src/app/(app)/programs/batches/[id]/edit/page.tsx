import { parseId } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { batches, programs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { BatchFields } from "@/components/programs/forms";
import { saveBatchAction } from "../../../actions";

export const metadata: Metadata = { title: "Edit batch" };

export default async function EditBatchPage({ params }: PageProps<"/programs/batches/[id]/edit">) {
  await requirePermission("programs.manage");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [[b], progs] = await Promise.all([db.select().from(batches).where(eq(batches.id, id)).limit(1), db.select({ id: programs.id, name: programs.name }).from(programs).orderBy(asc(programs.name))]);
  if (!b) notFound();
  return (
    <>
      <PageHeader title={`Edit · ${b.name}`} crumbs={[{ label: "Programs", href: "/programs" }, { label: b.name }]} />
      <Card className="max-w-2xl">
        <ActionForm action={saveBatchAction.bind(null, id)} submitLabel="Save changes" cancelHref="/programs">
          <BatchFields programs={progs} d={{ program_id: String(b.programId), name: b.name, start_date: b.startDate, fee: String(Number(b.fee)), seats: b.seats === null ? "" : String(b.seats), active: b.active }} />
        </ActionForm>
      </Card>
    </>
  );
}
