"use client";

import { createContext, useActionState, useContext, useRef } from "react";
import { ActionBar, ErrorSummary, useFormBehaviour } from "@/components/form-chrome";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/form-state";

const Ctx = createContext<FormState>({});

/**
 * A form wired to a server action. Child fields (TextField, SelectField…) pick up their error and the
 * value to keep on screen from the action's result, so pages can stay server components.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  cancelHref,
  className,
  danger,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel?: string;
  cancelHref?: string;
  className?: string;
  danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const dirty = useFormBehaviour(ref, state, pending);
  return (
    <Ctx.Provider value={state}>
      <form ref={ref} action={formAction} className={className ?? "space-y-4"} noValidate>
        <ErrorSummary state={state} />
        {children}
        <ActionBar pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} danger={danger} dirty={dirty} />
      </form>
    </Ctx.Provider>
  );
}

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

type Common = { name: string; label: string; required?: boolean; hint?: string; className?: string; defaultValue?: string | number | null };

function describedBy(name: string, error?: string, hint?: string) {
  return error ? `${name}-error` : hint ? `${name}-hint` : undefined;
}

function useField(name: string, defaultValue: Common["defaultValue"]) {
  const state = useContext(Ctx);
  return { value: String(state.values?.[name] ?? defaultValue ?? ""), error: state.fieldErrors?.[name] };
}

export function TextField({
  name, label, required, hint, className, defaultValue, type = "text", ...rest
}: Common & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "defaultValue">) {
  const { value, error } = useField(name, defaultValue);
  return (
    <Field label={label} htmlFor={name} required={required} hint={hint} error={error} className={className}>
      <Input id={name} name={name} type={type} defaultValue={value} autoComplete="off" maxLength={type === "text" || type === "tel" || type === "email" ? 200 : undefined} aria-required={required || undefined} aria-invalid={error ? true : undefined} aria-describedby={describedBy(name, error, hint)} {...rest} />
    </Field>
  );
}

export function SelectField({
  name, label, required, hint, className, defaultValue, options, emptyLabel = "None", ...rest
}: Common & { options: { value: string | number; label: string }[]; emptyLabel?: string | null } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "defaultValue">) {
  const { value, error } = useField(name, defaultValue);
  return (
    <Field label={label} htmlFor={name} required={required} hint={hint} error={error} className={className}>
      <Select id={name} name={name} defaultValue={value} aria-required={required || undefined} aria-invalid={error ? true : undefined} aria-describedby={describedBy(name, error, hint)} {...rest}>
        {emptyLabel !== null && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function AreaField({ name, label, required, hint, className, defaultValue, ...rest }: Common & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "defaultValue">) {
  const { value, error } = useField(name, defaultValue);
  return (
    <Field label={label} htmlFor={name} required={required} hint={hint} error={error} className={className}>
      <Textarea id={name} name={name} defaultValue={value} maxLength={2000} aria-invalid={error ? true : undefined} aria-describedby={describedBy(name, error, hint)} {...rest} />
    </Field>
  );
}
