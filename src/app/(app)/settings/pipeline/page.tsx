import type { Metadata } from "next";
import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db } from "@/db";
import { leadSources, leadTypes, pipelineStages } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page";
import { ConfirmButton } from "@/components/confirm-button";
import { Flash } from "@/components/flash";
import { deleteSourceAction, deleteStageAction, deleteTypeAction, saveSourceAction, saveStageAction, saveTypeAction } from "../actions";

export const metadata: Metadata = { title: "Statuses, sources & types" };

const KINDS = [{ value: "open", label: "In progress" }, { value: "won", label: "Enrolled (won)" }, { value: "lost", label: "Not interested (lost)" }];

export default async function PipelinePage() {
  await requirePermission("settings.pipeline");
  const [stages, sources, types] = await Promise.all([
    db.select().from(pipelineStages).orderBy(asc(pipelineStages.sortOrder), asc(pipelineStages.id)),
    db.select().from(leadSources).orderBy(asc(leadSources.name)),
    db.select().from(leadTypes).orderBy(asc(leadTypes.id)),
  ]);

  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader title="Statuses, sources & types" subtitle="Changes apply everywhere straight away." crumbs={[{ label: "Settings", href: "/settings" }, { label: "Statuses, sources & types" }]} />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardTitle className="mb-1">Pipeline statuses</CardTitle>
          <p className="mb-3 text-xs text-muted-foreground">New enquiries start at the first “in progress” status. The order number decides the order on screen.</p>
          <ul className="space-y-2">
            {stages.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <form action={saveStageAction.bind(null, s.id)} className="flex flex-1 flex-wrap items-center gap-2">
                  <Input name="sort_order" type="number" defaultValue={s.sortOrder} aria-label="Order" className="w-16" />
                  <Input name="name" defaultValue={s.name} aria-label="Status name" className="min-w-32 flex-1" required />
                  <Select name="kind" defaultValue={s.kind} aria-label="Kind" className="w-44">{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select>
                  <Input name="probability" type="number" min={0} max={100} defaultValue={s.probability} aria-label="Probability %" className="w-20" title="Chance of enrolling, %" />
                  <Button type="submit" variant="secondary" size="sm">Save</Button>
                </form>
                <form action={deleteStageAction.bind(null, s.id)}>
                  <ConfirmButton message={`Delete the status ${s.name}?`} variant="ghost" size="icon" aria-label={`Delete ${s.name}`}><Trash2 size={16} /></ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
          <form action={saveStageAction.bind(null, null)} className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Input name="sort_order" type="number" defaultValue={stages.length + 1} aria-label="Order" className="w-16" />
            <Input name="name" placeholder="New status…" aria-label="New status name" className="min-w-32 flex-1" required />
            <Select name="kind" defaultValue="open" aria-label="Kind" className="w-44">{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</Select>
            <Input name="probability" type="number" min={0} max={100} defaultValue={0} aria-label="Probability %" className="w-20" />
            <Button type="submit" size="sm">Add</Button>
          </form>
        </Card>

        <div className="space-y-4">
          {[
            { title: "Lead sources", rows: sources, save: saveSourceAction, del: deleteSourceAction, hint: "Where an enquiry came from." },
            { title: "Lead types", rows: types, save: saveTypeAction, del: deleteTypeAction, hint: "The first type is used for new enquiries." },
          ].map((g) => (
            <Card key={g.title}>
              <CardTitle className="mb-1">{g.title}</CardTitle>
              <p className="mb-3 text-xs text-muted-foreground">{g.hint}</p>
              <ul className="space-y-2">
                {g.rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <form action={g.save.bind(null, r.id)} className="flex flex-1 items-center gap-2">
                      <Input name="name" defaultValue={r.name} aria-label="Name" required />
                      <Button type="submit" variant="secondary" size="sm">Save</Button>
                    </form>
                    <form action={g.del.bind(null, r.id)}>
                      <ConfirmButton message={`Delete ${r.name}? Enquiries that used it keep no value.`} variant="ghost" size="icon" aria-label={`Delete ${r.name}`}><Trash2 size={16} /></ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={g.save.bind(null, null)} className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                <Input name="name" placeholder="Add…" aria-label={`Add to ${g.title}`} required />
                <Button type="submit" size="sm">Add</Button>
              </form>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
