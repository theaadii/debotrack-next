"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/form-state";

export function ActivityForm({ action }: { action: (state: FormState, form: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [type, setType] = useState("note");
  const planned = type !== "note";

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2" noValidate>
      <Field label="What" htmlFor="act-type">
        <Select id="act-type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="note">Note</option>
          <option value="call">Call (plan a follow-up)</option>
          <option value="meeting">Meeting</option>
          <option value="task">Task</option>
        </Select>
      </Field>
      {planned && (
        <Field label="When" htmlFor="act-when" error={state.fieldErrors?.starts_at}>
          <Input id="act-when" name="starts_at" type="datetime-local" defaultValue={state.values?.starts_at} />
        </Field>
      )}
      {planned && (
        <Field label="Title" htmlFor="act-title" className="md:col-span-2">
          <Input id="act-title" name="title" placeholder="e.g. Call about the fee" defaultValue={state.values?.title} />
        </Field>
      )}
      <Field label={planned ? "Details (optional)" : "Note"} htmlFor="act-comment" error={state.fieldErrors?.comment} className="md:col-span-2">
        <Textarea id="act-comment" name="comment" className="min-h-20" defaultValue={state.values?.comment} />
      </Field>
      {state.error && <p role="alert" className="text-sm text-danger md:col-span-2">{state.error}</p>}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add"}
        </Button>
      </div>
    </form>
  );
}
