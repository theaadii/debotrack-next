import { parseId } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { colleges, connections } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm } from "@/components/forms";
import { ConnectionFields } from "@/components/connections/fields";
import { saveConnectionAction } from "../../actions";

export const metadata: Metadata = { title: "Edit connection" };

export default async function EditConnectionPage({ params }: PageProps<"/connections/[id]/edit">) {
  await requirePermission("connections.manage");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [[row], options] = await Promise.all([
    db.select({ c: connections, institution: colleges.name }).from(connections).leftJoin(colleges, eq(colleges.id, connections.collegeId)).where(eq(connections.id, id)).limit(1),
    getOptions(),
  ]);
  if (!row) notFound();
  return (
    <>
      <PageHeader title={`Edit · ${row.c.name}`} crumbs={[{ label: "Connections", href: "/connections" }, { label: row.c.name }]} />
      <Card className="max-w-3xl">
        <ActionForm action={saveConnectionAction.bind(null, id)} submitLabel="Save changes" cancelHref="/connections">
          <ConnectionFields colleges={options.colleges} d={{ ...row.c, institution: row.institution }} />
        </ActionForm>
      </Card>
    </>
  );
}
