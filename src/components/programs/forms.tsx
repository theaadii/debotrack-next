import { AreaField, FormGrid, SelectField, TextField } from "@/components/forms";

function ActiveBox({ defaultChecked = true, label }: { defaultChecked?: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 pt-7 text-sm font-semibold">
      <input type="checkbox" name="active" defaultChecked={defaultChecked} className="h-4 w-4 accent-[var(--brand)]" />
      {label}
    </label>
  );
}

export function ProgramFields({ d }: { d?: { name?: string; description?: string | null; active?: boolean } }) {
  return (
    <FormGrid>
      <TextField name="name" label="Program name" required defaultValue={d?.name} className="md:col-span-2" />
      <AreaField name="description" label="Description" defaultValue={d?.description} className="md:col-span-2" />
      <ActiveBox defaultChecked={d?.active ?? true} label="Active (offered to new enquiries)" />
    </FormGrid>
  );
}

export function BatchFields({
  programs,
  d,
}: {
  programs: { id: number; name: string }[];
  d?: { program_id?: string; name?: string; start_date?: string | null; fee?: string; seats?: string; active?: boolean };
}) {
  return (
    <FormGrid>
      <SelectField name="program_id" label="Program" required emptyLabel="Choose…" defaultValue={d?.program_id} options={programs.map((p) => ({ value: p.id, label: p.name }))} />
      <TextField name="name" label="Batch name" required defaultValue={d?.name} placeholder="e.g. Jan 2027 weekday" />
      <TextField name="start_date" label="Start date" type="date" defaultValue={d?.start_date} />
      <TextField name="fee" label="Course fee (₹)" type="number" min="0" step="any" inputMode="decimal" required defaultValue={d?.fee} hint="Shown on enquiries for this batch; counsellors can only add a discount." />
      <TextField name="seats" label="Seats" type="number" min="0" defaultValue={d?.seats} />
      <ActiveBox defaultChecked={d?.active ?? true} label="Open for enquiries" />
    </FormGrid>
  );
}
