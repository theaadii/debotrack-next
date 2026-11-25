import { FormGrid, SelectField, TextField } from "@/components/forms";

export function UserFields({
  roles,
  d,
  editing,
}: {
  roles: { id: number; name: string }[];
  d?: { name?: string; email?: string; role_id?: string; active?: boolean };
  editing?: boolean;
}) {
  return (
    <FormGrid>
      <TextField name="name" label="Name" required defaultValue={d?.name} />
      <TextField name="email" label="Email (used to sign in)" type="email" required defaultValue={d?.email} autoComplete="off" />
      <SelectField name="role_id" label="Role" required emptyLabel="Choose…" defaultValue={d?.role_id} options={roles.map((r) => ({ value: r.id, label: r.name }))} />
      <TextField
        name="password"
        label={editing ? "New password (leave blank to keep)" : "Password"}
        type="password"
        required={!editing}
        autoComplete="new-password"
        hint="At least 10 characters, with upper-case, lower-case and a number."
      />
      <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
        <input type="checkbox" name="active" defaultChecked={d?.active ?? true} className="h-4 w-4 accent-[var(--brand)]" />
        Active (can sign in)
      </label>
    </FormGrid>
  );
}
