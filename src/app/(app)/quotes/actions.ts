"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads, learners, quoteItems, quotes } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { echo, type FormState } from "@/lib/form-state";
import { calcLine, calcQuote } from "@/lib/quote-calc";
import { optional, optionalInt, str, tidy } from "@/lib/utils";
import { dateProblem, LIMITS, tooLong } from "@/lib/validate";
import { logSystemActivity } from "@/server/leads";
import { quoteScope } from "@/server/quotes";
import { leadScope, learnerScope } from "@/server/scope";

const MAX_ITEMS = 50;

const itemSchema = z.object({
  sku: z.string().max(60, "The SKU can be at most 60 characters.").optional().default(""),
  name: z.string().trim().min(1, "Enter the item name.").max(LIMITS.short, `The item name can be at most ${LIMITS.short} characters.`),
  quantity: z.coerce.number("Quantity must be a number.").int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(100_000, "That quantity is too large."),
  price: z.coerce.number("Price must be a number.").min(0, "The price cannot be negative.").max(100_000_000, "That price is too large."),
  discountKind: z.enum(["percent", "amount"]),
  discountValue: z.coerce.number("The discount must be a number.").min(0, "The discount cannot be negative."),
  taxPercent: z.coerce.number("Tax must be a number.").min(0, "Tax cannot be negative.").max(100, "Tax cannot be more than 100%."),
});

/** Reads the whole quote form; returns the cleaned values, or the errors keyed by the id of the field they belong to. */
function parse(form: FormData) {
  const errors: Record<string, string> = {};
  const subject = tidy(str(form, "subject"));
  if (!subject) errors.subject = "Enter a subject for the quote.";
  else if (subject.length > LIMITS.short) errors.subject = `The subject can be at most ${LIMITS.short} characters.`;

  const description = optional(form, "description");
  const d = tooLong(description, LIMITS.long, "The description");
  if (d) errors.description = d;

  const expiredAt = optional(form, "expired_at");
  if (expiredAt) {
    const p = dateProblem(expiredAt);
    if (p) errors.expired_at = p;
  }

  const adjustment = Number(str(form, "adjustment").replace(/,/g, "") || 0);
  if (!Number.isFinite(adjustment) || Math.abs(adjustment) > 100_000_000) errors.adjustment = "Enter the adjustment as a number (negative to reduce the total).";

  const bill = {
    address: str(form, "bill_address"),
    city: str(form, "bill_city"),
    state: str(form, "bill_state"),
    postcode: str(form, "bill_postcode"),
    country: str(form, "bill_country"),
  };
  for (const [k, v] of Object.entries(bill)) {
    const e = tooLong(v, k === "address" ? LIMITS.long : LIMITS.short, "That address line");
    if (e) errors[`bill_${k}`] = e;
  }

  let rawItems: unknown = [];
  try {
    rawItems = JSON.parse(str(form, "items_json") || "[]");
  } catch {
    errors.items = "The items could not be read. Reload the page and try again.";
  }
  const list = Array.isArray(rawItems) ? rawItems : [];
  const items: z.infer<typeof itemSchema>[] = [];
  if (list.length === 0) errors.items = "Add at least one item.";
  else if (list.length > MAX_ITEMS) errors.items = `A quote can have at most ${MAX_ITEMS} items.`;
  else {
    list.forEach((raw, i) => {
      const r = itemSchema.safeParse(raw);
      if (r.success) {
        items.push(r.data);
        const calc = calcLine({ quantity: r.data.quantity, price: r.data.price, discountKind: r.data.discountKind, discountValue: r.data.discountValue, taxPercent: r.data.taxPercent });
        if (r.data.discountKind === "percent" && r.data.discountValue > 100) errors[`item_${i}_discount`] = "A percentage discount cannot be more than 100.";
        else if (r.data.discountKind === "amount" && r.data.discountValue > calc.amount) errors[`item_${i}_discount`] = "The discount cannot be more than the item's amount.";
      } else {
        for (const issue of r.error.issues) {
          const key = issue.path[0] === "name" ? "name" : issue.path[0] === "quantity" ? "qty" : issue.path[0] === "price" ? "price" : issue.path[0] === "taxPercent" ? "tax" : issue.path[0] === "sku" ? "sku" : "discount";
          errors[`item_${i}_${key}`] ??= issue.message;
        }
      }
    });
  }

  const totals = Object.keys(errors).length === 0 ? calcQuote(items.map((it) => ({ quantity: it.quantity, price: it.price, discountKind: it.discountKind, discountValue: it.discountValue, taxPercent: it.taxPercent })), adjustment) : null;
  if (totals && totals.grandTotal < 0) errors.adjustment = "The adjustment makes the total negative.";

  return { errors, subject, description, expiredAt, adjustment, bill, items, totals };
}

const addressOrNull = (b: { address: string; city: string; state: string; postcode: string; country: string }) => (Object.values(b).some(Boolean) ? b : null);
const money = (n: number) => n.toFixed(2);

type Recipient = { ok: boolean; learnerId: number | null; leadId: number | null; kind: "learner" | "college" | "vendor" | "other"; name: string | null; contact: string | null };
const KINDS = ["learner", "college", "vendor", "other"] as const;

/** Who the quote is for: a learner (and optional enquiry) the person may see, or a college / vendor / other organisation by name. */
async function resolveLinks(session: Awaited<ReturnType<typeof requireSession>>, form: FormData, errors: Record<string, string>): Promise<Recipient> {
  const kindRaw = String(form.get("recipient_kind") ?? "learner");
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as Recipient["kind"]) : "learner";
  const none = { ok: false, learnerId: null, leadId: null, kind, name: null, contact: null };

  if (kind !== "learner") {
    const name = str(form, "recipient_name");
    const contact = optional(form, "recipient_contact");
    if (!name) errors.recipient_name = kind === "college" ? "Enter the college or institute name." : "Enter who the quote is for.";
    else if (name.length > 200) errors.recipient_name = "Keep the name under 200 characters.";
    if (contact && contact.length > 200) errors.recipient_contact = "Keep the contact under 200 characters.";
    if (errors.recipient_name || errors.recipient_contact) return none;
    return { ok: true, learnerId: null, leadId: null, kind, name, contact };
  }

  const learnerId = optionalInt(form, "learner_id");
  const leadId = optionalInt(form, "lead_id");
  if (!learnerId) {
    errors.learner_search = "Choose the learner this quote is for.";
    return none;
  }
  const [l] = await db.select({ id: learners.id }).from(learners).where(and(eq(learners.id, learnerId), learnerScope(session))).limit(1);
  if (!l) {
    errors.learner_search = "That learner could not be found.";
    return none;
  }
  let lead: number | null = null;
  if (leadId) {
    const [e] = await db.select({ id: leads.id }).from(leads).where(and(eq(leads.id, leadId), eq(leads.learnerId, learnerId), leadScope(session))).limit(1);
    lead = e?.id ?? null;
  }
  return { ok: true, learnerId: l.id, leadId: lead, kind, name: null, contact: null };
}

/** What the form shows again after a failed save. The items live in the form's own state, so only the plain fields are echoed. */
const keep = (form: FormData) => {
  const v = echo(form);
  return v;
};

async function saveItems(tx: Pick<typeof db, "insert" | "delete">, quoteId: number, items: z.infer<typeof itemSchema>[]) {
  await tx.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  if (items.length === 0) return;
  await tx.insert(quoteItems).values(
    items.map((it, position) => {
      const r = calcLine({ quantity: it.quantity, price: it.price, discountKind: it.discountKind, discountValue: it.discountValue, taxPercent: it.taxPercent });
      return {
        quoteId,
        position,
        sku: it.sku.trim() || null,
        name: it.name,
        quantity: it.quantity,
        price: money(it.price),
        discountKind: it.discountKind,
        discountValue: money(it.discountValue),
        discountAmount: money(r.discountAmount),
        taxPercent: money(it.taxPercent),
        taxAmount: money(r.taxAmount),
        total: money(r.total),
      };
    }),
  );
}

export async function createQuoteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.can("quotes.create")) return { error: "You don't have permission to create quotes." };

  const p = parse(form);
  const rcpt = await resolveLinks(session, form, p.errors);
  const { leadId } = rcpt;
  if (Object.keys(p.errors).length || !p.totals || !rcpt.ok) return { fieldErrors: p.errors, error: "Please fix the highlighted fields.", values: keep(form) };

  // Counsellors who only see their own work always own what they create.
  const ownerId = session.user.viewScope === "all" ? (optionalInt(form, "owner_id") ?? session.user.id) : session.user.id;
  const t = p.totals;

  const id = await db.transaction(async (tx) => {
    const [q] = await tx
      .insert(quotes)
      .values({
        subject: p.subject, description: p.description, learnerId: rcpt.learnerId, recipientKind: rcpt.kind, recipientName: rcpt.name, recipientContact: rcpt.contact, leadId, ownerId, billingAddress: addressOrNull(p.bill), expiredAt: p.expiredAt,
        subTotal: money(t.subTotal), discountAmount: money(t.discountAmount), taxAmount: money(t.taxAmount), adjustmentAmount: money(t.adjustmentAmount), grandTotal: money(t.grandTotal),
      })
      .returning({ id: quotes.id });
    await saveItems(tx, q!.id, p.items);
    return q!.id;
  });

  if (leadId) await logSystemActivity(leadId, session.user.id, "Quote created", p.subject);
  revalidatePath("/quotes");
  if (leadId) revalidatePath(`/leads/${leadId}`);
  redirect(`/quotes/${id}?saved=created`);
}

export async function updateQuoteAction(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.can("quotes.edit")) return { error: "You don't have permission to edit quotes." };
  const [current] = await db.select({ id: quotes.id, ownerId: quotes.ownerId, leadId: quotes.leadId }).from(quotes).where(and(eq(quotes.id, id), quoteScope(session))).limit(1);
  if (!current) return { error: "This quote no longer exists." };

  const p = parse(form);
  const rcpt = await resolveLinks(session, form, p.errors);
  const { leadId } = rcpt;
  if (Object.keys(p.errors).length || !p.totals || !rcpt.ok) return { fieldErrors: p.errors, error: "Please fix the highlighted fields.", values: keep(form) };

  const ownerId = session.user.viewScope === "all" ? (optionalInt(form, "owner_id") ?? current.ownerId) : current.ownerId;
  const t = p.totals;

  await db.transaction(async (tx) => {
    await tx
      .update(quotes)
      .set({
        subject: p.subject, description: p.description, learnerId: rcpt.learnerId, recipientKind: rcpt.kind, recipientName: rcpt.name, recipientContact: rcpt.contact, leadId, ownerId, billingAddress: addressOrNull(p.bill), expiredAt: p.expiredAt,
        subTotal: money(t.subTotal), discountAmount: money(t.discountAmount), taxAmount: money(t.taxAmount), adjustmentAmount: money(t.adjustmentAmount), grandTotal: money(t.grandTotal),
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id));
    await saveItems(tx, id, p.items);
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  if (leadId) revalidatePath(`/leads/${leadId}`);
  redirect(`/quotes/${id}?saved=updated`);
}

export async function deleteQuoteAction(id: number) {
  const session = await requireSession();
  if (!session.can("quotes.delete")) redirect("/forbidden");
  const [q] = await db.select({ leadId: quotes.leadId }).from(quotes).where(and(eq(quotes.id, id), quoteScope(session))).limit(1);
  if (q) await db.delete(quotes).where(eq(quotes.id, id));
  revalidatePath("/quotes");
  if (q?.leadId) revalidatePath(`/leads/${q.leadId}`);
  redirect("/quotes?saved=deleted");
}
