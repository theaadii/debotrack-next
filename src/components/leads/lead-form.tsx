"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ActionBar, ErrorSummary, useFormBehaviour } from "@/components/form-chrome";
import { MatchHint } from "@/components/learners/match-hint";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { computeFinalFee } from "@/lib/fees";
import type { FormState } from "@/lib/form-state";
import { formatMoney } from "@/lib/utils";
import type { Options } from "@/server/options";
import { Blank } from "@/components/ui/blank";

export type LeadFormValues = Partial<Record<
  | "learner_id" | "name" | "phone" | "email" | "college" | "branch" | "year" | "city" | "qualification"
  | "source_id" | "type_id" | "owner_id" | "expected_close_date" | "program_id" | "batch_id"
  | "discount_type" | "discount_value" | "remarks",
  string
>>;

const YEARS = [1, 2, 3, 4, 5, 6];
const ord = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} Year`;

export function LeadForm({
  action,
  options,
  initial,
  canPickOwner,
  submitLabel,
  cancelHref,
  linkedLearner,
  learnerId,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  options: Options;
  initial: LeadFormValues;
  canPickOwner: boolean;
  submitLabel: string;
  cancelHref: string;
  linkedLearner?: boolean;
  learnerId?: number;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const dirty = useFormBehaviour(ref, state, pending);
  const v = (k: keyof LeadFormValues) => state.values?.[k] ?? initial[k] ?? "";
  const err = (k: string) => state.fieldErrors?.[k];

  const [programId, setProgramId] = useState(v("program_id"));
  const [batchId, setBatchId] = useState(v("batch_id"));
  const [discountType, setDiscountType] = useState(v("discount_type"));
  const [discountValue, setDiscountValue] = useState(v("discount_value"));

  const program = options.programs.find((p) => String(p.id) === programId);
  const batch = program?.batches.find((b) => String(b.id) === batchId);
  const courseFee = batch ? batch.fee : null;
  const finalFee = computeFinalFee(courseFee, discountType === "percent" || discountType === "fixed" ? discountType : null, Number(discountValue) || 0);


  return (
    <form ref={ref} action={formAction} className="space-y-4" noValidate>
      <ErrorSummary state={state} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="max-w-3xl space-y-4">
      {initial.learner_id && <input type="hidden" name="learner_id" value={initial.learner_id} />}

      <Card>
        <CardTitle className="mb-1">Student</CardTitle>
        {linkedLearner ? (
          <p className="mb-3 text-xs text-muted-foreground">This enquiry is linked to an existing learner. Blank details are filled in; saved ones stay as they are.</p>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">If this phone or email is already saved, the enquiry is linked to that learner instead of making a duplicate.</p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Student name" htmlFor="name" required error={err("name")} className="md:col-span-2">
            <Input id="name" name="name" defaultValue={v("name")} autoComplete="off" maxLength={120} aria-required aria-invalid={err("name") ? true : undefined} aria-describedby={err("name") ? "name-error" : undefined} />
          </Field>
          <Field label="Phone" htmlFor="phone" required error={err("phone")} hint="Several numbers: separate with commas">
            <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={v("phone")} autoComplete="off" maxLength={80} placeholder="98765 43210" aria-invalid={err("phone") ? true : undefined} aria-describedby={err("phone") ? "phone-error" : "phone-hint"} />
          </Field>
          <Field label="Email" htmlFor="email" error={err("email")}>
            <Input id="email" name="email" type="email" defaultValue={v("email")} autoComplete="off" maxLength={254} placeholder="name@example.com" aria-invalid={err("email") ? true : undefined} aria-describedby={err("email") ? "email-error" : undefined} />
          </Field>
          <MatchHint mode="enquiry" except={learnerId ?? (Number(initial.learner_id) || undefined)} />
          <Field label="School / College / Company" htmlFor="college" className="md:col-span-2" hint="Pick a saved one, or type a new name to add it.">
            <Input id="college" name="college" list="college-list" defaultValue={v("college")} autoComplete="off" />
            <datalist id="college-list">
              {options.colleges.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Year" htmlFor="year">
            <Select id="year" name="year" defaultValue={v("year")}>
              <option value="">None</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {ord(y)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branch / Stream" htmlFor="branch">
            <Input id="branch" name="branch" defaultValue={v("branch")} autoComplete="off" />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={v("city")} autoComplete="off" />
          </Field>
          <Field label="Qualification" htmlFor="qualification">
            <Input id="qualification" name="qualification" defaultValue={v("qualification")} autoComplete="off" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-3">Enquiry details</CardTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Lead source" htmlFor="source_id">
            <Select id="source_id" name="source_id" defaultValue={v("source_id")}>
              <option value="">None</option>
              {options.sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Lead type" htmlFor="type_id">
            <Select id="type_id" name="type_id" defaultValue={v("type_id") || String(options.types[0]?.id ?? "")}>
              {options.types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          {canPickOwner && (
            <Field label="Counsellor" htmlFor="owner_id">
              <Select id="owner_id" name="owner_id" defaultValue={v("owner_id")}>
                <option value="">Me</option>
                {options.counsellors.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Expected enrolment date" htmlFor="expected_close_date" error={err("expected_close_date")}>
            <Input id="expected_close_date" name="expected_close_date" type="date" defaultValue={v("expected_close_date")} />
          </Field>

          <Field label="Program" htmlFor="program_id" error={err("program_id")}>
            <Select
              id="program_id"
              name="program_id"
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setBatchId("");
              }}
            >
              <option value="">None</option>
              {options.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Batch" htmlFor="batch_id" error={err("batch_id")} hint={program && program.batches.length === 0 ? "This program has no active batches." : undefined}>
            <Select id="batch_id" name="batch_id" value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!program}>
              <option value="">{program ? <Blank /> : "Choose a program first"}</option>
              {program?.batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-[1fr_1fr] gap-3 md:col-span-2">
            <Field label="Discount" htmlFor="discount_type" error={err("discount_type")}>
              <Select id="discount_type" name="discount_type" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="">None</option>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed (₹)</option>
              </Select>
            </Field>
            <Field label={discountType === "percent" ? "Percent off" : "Amount off"} htmlFor="discount_value" error={err("discount_value")}>
              <Input
                id="discount_value"
                name="discount_value"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                disabled={!discountType}
              />
            </Field>
          </div>
          <Field label="Remarks" htmlFor="remarks" className="md:col-span-2">
            <Textarea id="remarks" name="remarks" defaultValue={v("remarks")} maxLength={2000} />
          </Field>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Need a program or batch that isn&apos;t listed? <Link href="/programs" className="text-brand underline">Manage programs</Link>.
      </p>
      </div>

      <aside aria-label="Fee summary" className="xl:sticky xl:top-20">
        <Card>
          <CardTitle className="mb-3">Fee summary</CardTitle>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Program</dt>
              <dd className="text-right font-medium">{program?.name ?? <Blank />}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Batch</dt>
              <dd className="text-right font-medium">{batch?.name ?? <Blank />}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Course fee</dt>
              <dd className="font-medium">{courseFee === null ? <Blank /> : formatMoney(courseFee)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="font-medium">
                {courseFee !== null && finalFee !== null && courseFee - finalFee > 0 ? `− ${formatMoney(courseFee - finalFee)}${discountType === "percent" ? ` (${Number(discountValue)}%)` : ""}` : "None"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <dt className="font-bold">Final fee</dt>
              <dd className="text-xl font-extrabold text-brand" aria-live="polite">{finalFee === null ? <Blank /> : formatMoney(finalFee)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{courseFee === null ? "Choose a batch to see the fee. The fee comes from the batch and can't be typed in." : "The course fee comes from the batch. Only the discount can be changed."}</p>
        </Card>
      </aside>
      </div>

      <ActionBar pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} dirty={dirty} />
    </form>
  );
}
