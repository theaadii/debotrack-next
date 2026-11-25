"use client";

import { useState } from "react";
import { FormGrid, SelectField, TextField, AreaField } from "@/components/forms";
import { PERMISSION_GROUPS } from "@/lib/permissions";

export function RoleFields({ d }: { d?: { name?: string; description?: string | null; permissionType?: string; viewScope?: string; permissions?: string[] } }) {
  const [type, setType] = useState(d?.permissionType ?? "custom");
  const [chosen, setChosen] = useState(() => new Set(d?.permissions ?? []));
  const full = type === "all";
  const toggle = (keys: string[], on: boolean) =>
    setChosen((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  const all = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
  const counsellorKeys = ["leads.view", "leads.create", "leads.edit", "leads.import", "leads.export", "learners.view", "learners.manage", "programs.view", "connections.view", "activities.manage", "quotes.view", "quotes.create", "quotes.edit"];
  return (
    <div className="space-y-5">
      <FormGrid>
        <TextField name="name" label="Role name" required defaultValue={d?.name} />
        <SelectField name="view_scope" label="Which enquiries and learners can they see?" emptyLabel={null} defaultValue={d?.viewScope ?? "all"} options={[{ value: "all", label: "Everyone's" }, { value: "own", label: "Only their own" }]} />
        <AreaField name="description" label="Description" defaultValue={d?.description} className="md:col-span-2" />
        <SelectField name="permission_type" label="Access" emptyLabel={null} defaultValue={type} onChange={(e) => setType(e.target.value)} className="md:col-span-2" hint="“Full access” ignores the checkboxes below: it is for administrators." options={[{ value: "custom", label: "Only what is ticked below" }, { value: "all", label: "Full access (administrator)" }]} />
      </FormGrid>
      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-bold">Permissions</legend>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button type="button" disabled={full} onClick={() => setChosen(new Set(counsellorKeys))} className="rounded-full border border-border px-3 py-1 font-semibold hover:bg-muted disabled:opacity-50">Counsellor preset</button>
          <button type="button" disabled={full} onClick={() => setChosen(new Set(all))} className="rounded-full border border-border px-3 py-1 font-semibold hover:bg-muted disabled:opacity-50">Tick all</button>
          <button type="button" disabled={full} onClick={() => setChosen(new Set())} className="rounded-full border border-border px-3 py-1 font-semibold hover:bg-muted disabled:opacity-50">Clear</button>
          <span className="text-muted-foreground" aria-live="polite">{full ? "Full access: every permission is on." : `${chosen.size} of ${all.length} ticked`}</span>
        </div>
        {PERMISSION_GROUPS.map((g) => (
          <div key={g.group}>
            <div className="mb-1.5 flex items-center gap-3">
              <p className="text-sm font-semibold text-muted-foreground">{g.group}</p>
              <button type="button" disabled={full} className="text-xs text-brand underline disabled:opacity-50" onClick={() => toggle(g.items.map((i) => i.key), !g.items.every((i) => chosen.has(i.key)))}>
                {g.items.every((i) => chosen.has(i.key)) ? "Clear group" : "Tick group"}
              </button>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {g.items.map((i) => (
                <label key={i.key} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="permissions" value={i.key} checked={full || chosen.has(i.key)} disabled={full} onChange={(e) => toggle([i.key], e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
                  {i.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
