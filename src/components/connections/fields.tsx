import { AreaField, FormGrid, TextField } from "@/components/forms";

const DESIGNATIONS = ["HOD", "Principal", "TPO", "Dean", "Placement officer", "Faculty", "Director", "Trustee"];

export function ConnectionFields({
  colleges,
  d,
}: {
  colleges: { id: number; name: string }[];
  d?: { name?: string; designation?: string | null; phone?: string | null; email?: string | null; institution?: string | null; notes?: string | null };
}) {
  return (
    <FormGrid>
      <TextField name="name" label="Name" required defaultValue={d?.name} className="md:col-span-2" />
      <div>
        <TextField name="designation" label="Designation" list="designation-list" defaultValue={d?.designation} hint="HOD, Principal, TPO… or type your own" />
        <datalist id="designation-list">{DESIGNATIONS.map((x) => <option key={x} value={x} />)}</datalist>
      </div>
      <div>
        <TextField name="institution" label="School / College" list="institution-list" defaultValue={d?.institution} />
        <datalist id="institution-list">{colleges.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </div>
      <TextField name="phone" label="Phone" type="tel" inputMode="tel" defaultValue={d?.phone} />
      <TextField name="email" label="Email" type="email" defaultValue={d?.email} />
      <AreaField name="notes" label="Notes" defaultValue={d?.notes} className="md:col-span-2" />
    </FormGrid>
  );
}
