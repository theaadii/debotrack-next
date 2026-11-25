"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";
import { ActionBar, ErrorSummary, useFormBehaviour } from "@/components/form-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { LearnerPicker, type PickedLearner } from "@/components/quotes/learner-picker";
import type { FormState } from "@/lib/form-state";
import { calcLine, calcQuote, type DiscountKind } from "@/lib/quote-calc";
import { formatMoney } from "@/lib/utils";
import type { Options } from "@/server/options";

export type QuoteItemValues = { key: string; sku: string; name: string; quantity: string; price: string; discountKind: DiscountKind; discountValue: string; taxPercent: string };

export type QuoteFormValues = {
  subject: string;
  description: string;
  expired_at: string;
  owner_id: string;
  lead_id: string;
  adjustment: string;
  bill_address: string;
  bill_city: string;
  bill_state: string;
  bill_postcode: string;
  bill_country: string;
  learner: PickedLearner | null;
  items: QuoteItemValues[];
};

let counter = 0;
export const newItem = (over: Partial<QuoteItemValues> = {}): QuoteItemValues => ({ key: `i${++counter}-${Date.now()}`, sku: "", name: "", quantity: "1", price: "", discountKind: "percent", discountValue: "", taxPercent: "", ...over });

const num = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function QuoteForm({
  action,
  options,
  initial,
  canPickOwner,
  submitLabel,
  cancelHref,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  options: Options;
  initial: QuoteFormValues;
  canPickOwner: boolean;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const dirty = useFormBehaviour(ref, state, pending);
  const v = (k: keyof QuoteFormValues & string) => state.values?.[k] ?? (initial[k as keyof QuoteFormValues] as string) ?? "";
  const err = (k: string) => state.fieldErrors?.[k];

  const [learner, setLearner] = useState<PickedLearner | null>(initial.learner);
  const [items, setItems] = useState<QuoteItemValues[]>(initial.items.length ? initial.items : [newItem()]);
  const [adjustment, setAdjustment] = useState(v("adjustment"));
  const [batchPick, setBatchPick] = useState("");
  const [city, setCity] = useState(v("bill_city"));

  const patch = (key: string, p: Partial<QuoteItemValues>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)));
  const totals = useMemo(
    () => calcQuote(items.map((it) => ({ quantity: Math.floor(num(it.quantity)), price: num(it.price), discountKind: it.discountKind, discountValue: num(it.discountValue), taxPercent: num(it.taxPercent) })), num(adjustment)),
    [items, adjustment],
  );

  const batches = options.programs.flatMap((p) => p.batches.map((b) => ({ id: b.id, label: `${p.name} · ${b.name}`, fee: b.fee })));
  const addBatch = (id: string) => {
    const b = batches.find((x) => String(x.id) === id);
    if (!b) return;
    // Reuse a single blank starter row rather than leaving an empty line above the new one.
    setItems((list) => {
      const blank = list.length === 1 && !list[0]!.name && !list[0]!.price;
      const row = newItem({ name: b.label, price: String(b.fee) });
      return blank ? [row] : [...list, row];
    });
    setBatchPick("");
  };

  const itemErrors = (i: number) => ["name", "sku", "qty", "price", "discount", "tax"].map((k) => err(`item_${i}_${k}`)).filter(Boolean) as string[];

  return (
    <form ref={ref} action={formAction} className="space-y-4" noValidate>
      <ErrorSummary state={state} />
      <input type="hidden" name="learner_id" value={learner?.id ?? ""} />
      <input type="hidden" name="lead_id" value={initial.lead_id} />
      <input type="hidden" name="items_json" value={JSON.stringify(items.map((it) => ({ sku: it.sku, name: it.name, quantity: it.quantity, price: it.price, discountKind: it.discountKind, discountValue: it.discountValue, taxPercent: it.taxPercent })))} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardTitle className="mb-3">Quote</CardTitle>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Subject" htmlFor="subject" required error={err("subject")} className="md:col-span-2">
                <Input id="subject" name="subject" defaultValue={v("subject")} maxLength={200} aria-required aria-invalid={err("subject") ? true : undefined} aria-describedby={err("subject") ? "subject-error" : undefined} placeholder="e.g. Full stack program, January batch" />
              </Field>
              <Field label="Valid until" htmlFor="expired_at" error={err("expired_at")}>
                <Input id="expired_at" name="expired_at" type="date" defaultValue={v("expired_at")} aria-invalid={err("expired_at") ? true : undefined} />
              </Field>
              {canPickOwner && (
                <Field label="Sales person" htmlFor="owner_id">
                  <Select id="owner_id" name="owner_id" defaultValue={v("owner_id")}>
                    <option value="">Me</option>
                    {options.counsellors.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Description" htmlFor="description" error={err("description")} className="md:col-span-2" hint="Shown on the quote, for example what the fee includes.">
                <Textarea id="description" name="description" defaultValue={v("description")} maxLength={2000} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardTitle className="mb-3">Bill to</CardTitle>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Learner" htmlFor="learner_search" required error={err("learner_search")} className="md:col-span-2">
                <LearnerPicker
                  value={learner}
                  error={err("learner_search")}
                  onChange={(l) => {
                    setLearner(l);
                    if (l && !city && l.city) setCity(l.city);
                  }}
                />
              </Field>
              <Field label="Address" htmlFor="bill_address" error={err("bill_address")} className="md:col-span-2">
                <Input id="bill_address" name="bill_address" defaultValue={v("bill_address")} maxLength={2000} />
              </Field>
              <Field label="City" htmlFor="bill_city" error={err("bill_city")}>
                <Input id="bill_city" name="bill_city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={200} />
              </Field>
              <Field label="State" htmlFor="bill_state" error={err("bill_state")}>
                <Input id="bill_state" name="bill_state" defaultValue={v("bill_state")} maxLength={200} />
              </Field>
              <Field label="Postcode" htmlFor="bill_postcode" error={err("bill_postcode")}>
                <Input id="bill_postcode" name="bill_postcode" defaultValue={v("bill_postcode")} maxLength={200} inputMode="numeric" />
              </Field>
              <Field label="Country" htmlFor="bill_country" error={err("bill_country")}>
                <Input id="bill_country" name="bill_country" defaultValue={v("bill_country") || "India"} maxLength={200} />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Items</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {batches.length > 0 && (
                  <Select aria-label="Add a program batch as an item" value={batchPick} onChange={(e) => addBatch(e.target.value)} className="h-9 w-56 text-sm">
                    <option value="">Add a program batch…</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.label} ({formatMoney(b.fee)})</option>
                    ))}
                  </Select>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={() => setItems((l) => [...l, newItem()])} disabled={items.length >= 50}>
                  <Plus size={14} aria-hidden /> Add item
                </Button>
              </div>
            </div>
            {err("items") && <p role="alert" className="mb-3 text-sm font-medium text-danger">{err("items")}</p>}

            <ol className="space-y-3">
              {items.map((it, i) => {
                const line = calcLine({ quantity: Math.floor(num(it.quantity)), price: num(it.price), discountKind: it.discountKind, discountValue: num(it.discountValue), taxPercent: num(it.taxPercent) });
                const errs = itemErrors(i);
                return (
                  <li key={it.key} className="rounded-xl border border-border p-3">
                    <div className="grid gap-3 md:grid-cols-12">
                      <Field label={`Item ${i + 1}`} htmlFor={`item_${i}_name`} required className="md:col-span-5">
                        <Input id={`item_${i}_name`} value={it.name} onChange={(e) => patch(it.key, { name: e.target.value })} maxLength={200} aria-invalid={err(`item_${i}_name`) ? true : undefined} />
                      </Field>
                      <Field label="SKU" htmlFor={`item_${i}_sku`} className="md:col-span-3">
                        <Input id={`item_${i}_sku`} value={it.sku} onChange={(e) => patch(it.key, { sku: e.target.value })} maxLength={60} aria-invalid={err(`item_${i}_sku`) ? true : undefined} />
                      </Field>
                      <Field label="Quantity" htmlFor={`item_${i}_qty`} className="md:col-span-2">
                        <Input id={`item_${i}_qty`} type="number" inputMode="numeric" min="1" step="1" value={it.quantity} onChange={(e) => patch(it.key, { quantity: e.target.value })} aria-invalid={err(`item_${i}_qty`) ? true : undefined} />
                      </Field>
                      <Field label="Price (₹)" htmlFor={`item_${i}_price`} className="md:col-span-2">
                        <Input id={`item_${i}_price`} type="number" inputMode="decimal" min="0" step="any" value={it.price} onChange={(e) => patch(it.key, { price: e.target.value })} aria-invalid={err(`item_${i}_price`) ? true : undefined} />
                      </Field>

                      <div className="grid grid-cols-[1fr_1fr] gap-2 md:col-span-4">
                        <Field label="Discount" htmlFor={`item_${i}_dkind`}>
                          <Select id={`item_${i}_dkind`} value={it.discountKind} onChange={(e) => patch(it.key, { discountKind: e.target.value as DiscountKind })}>
                            <option value="percent">Percent (%)</option>
                            <option value="amount">Amount (₹)</option>
                          </Select>
                        </Field>
                        <Field label={it.discountKind === "percent" ? "Percent off" : "Amount off"} htmlFor={`item_${i}_discount`}>
                          <Input id={`item_${i}_discount`} type="number" inputMode="decimal" min="0" step="any" value={it.discountValue} onChange={(e) => patch(it.key, { discountValue: e.target.value })} aria-invalid={err(`item_${i}_discount`) ? true : undefined} />
                        </Field>
                      </div>
                      <Field label="Tax (%)" htmlFor={`item_${i}_tax`} className="md:col-span-2">
                        <Input id={`item_${i}_tax`} type="number" inputMode="decimal" min="0" max="100" step="any" value={it.taxPercent} onChange={(e) => patch(it.key, { taxPercent: e.target.value })} aria-invalid={err(`item_${i}_tax`) ? true : undefined} placeholder="0" />
                      </Field>
                      <div className="flex items-end justify-between gap-3 md:col-span-6">
                        <div>
                          <p className="text-sm font-semibold">Line total</p>
                          <p className="text-lg font-extrabold tabular-nums text-brand" aria-live="polite">{formatMoney(line.total)}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setItems((l) => (l.length > 1 ? l.filter((x) => x.key !== it.key) : [newItem()]))} aria-label={`Remove item ${i + 1}`}>
                          <Trash2 size={14} aria-hidden /> Remove
                        </Button>
                      </div>
                    </div>
                    {errs.length > 0 && (
                      <ul role="alert" className="mt-2 list-disc space-y-0.5 pl-5 text-xs font-medium text-danger">
                        {errs.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <aside aria-label="Quote totals" className="xl:sticky xl:top-20">
          <Card>
            <CardTitle className="mb-3">Totals</CardTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Sub total</dt>
                <dd className="font-medium tabular-nums">{formatMoney(totals.subTotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="font-medium tabular-nums">{totals.discountAmount > 0 ? `− ${formatMoney(totals.discountAmount)}` : "None"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="font-medium tabular-nums">{formatMoney(totals.taxAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground"><label htmlFor="adjustment">Adjustment</label></dt>
                <dd>
                  <Input id="adjustment" name="adjustment" type="number" inputMode="decimal" step="any" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} className="h-9 w-28 text-right" placeholder="0" aria-invalid={err("adjustment") ? true : undefined} />
                </dd>
              </div>
              {err("adjustment") && <p role="alert" className="text-xs font-medium text-danger">{err("adjustment")}</p>}
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
                <dt className="font-bold">Grand total</dt>
                <dd className="text-xl font-extrabold tabular-nums text-brand" aria-live="polite">{formatMoney(totals.grandTotal)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Tax is worked on the amount after the discount. Use a negative adjustment to reduce the total, for example a rounding off.</p>
          </Card>
        </aside>
      </div>

      <ActionBar pending={pending} submitLabel={submitLabel} cancelHref={cancelHref} dirty={dirty} />
    </form>
  );
}
