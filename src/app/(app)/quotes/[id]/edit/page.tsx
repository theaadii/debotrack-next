import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { getQuote, quoteNumber } from "@/server/quotes";
import { PageHeader } from "@/components/ui/page";
import { newItem, QuoteForm, type QuoteFormValues } from "@/components/quotes/quote-form";
import { parseId } from "@/lib/utils";
import { updateQuoteAction } from "../../actions";

export const metadata: Metadata = { title: "Edit quote" };

export default async function EditQuotePage({ params }: PageProps<"/quotes/[id]/edit">) {
  const session = await requirePermission("quotes.edit");
  const id = parseId((await params).id);
  if (!Number.isInteger(id)) notFound();
  const q = await getQuote(session, id);
  if (!q) notFound();
  const options = await getOptions();

  const a = q.billingAddress ?? {};
  const initial: QuoteFormValues = {
    subject: q.subject,
    description: q.description ?? "",
    expired_at: q.expiredAt ?? "",
    owner_id: q.ownerId ? String(q.ownerId) : "",
    lead_id: q.leadId ? String(q.leadId) : "",
    adjustment: Number(q.adjustmentAmount) ? String(Number(q.adjustmentAmount)) : "",
    bill_address: a.address ?? "", bill_city: a.city ?? "", bill_state: a.state ?? "", bill_postcode: a.postcode ?? "", bill_country: a.country ?? "",
    learner: { id: q.learnerId, name: q.learner, phone: q.phones[0] ?? "", email: q.emails[0] ?? "", city: "" },
    items: q.items.map((it) =>
      newItem({ sku: it.sku ?? "", name: it.name, quantity: String(it.quantity), price: String(Number(it.price)), discountKind: it.discountKind, discountValue: Number(it.discountValue) ? String(Number(it.discountValue)) : "", taxPercent: Number(it.taxPercent) ? String(Number(it.taxPercent)) : "" }),
    ),
  };

  return (
    <>
      <PageHeader title={`Edit ${quoteNumber(q.id)}`} crumbs={[{ label: "Quotes", href: "/quotes" }, { label: quoteNumber(q.id), href: `/quotes/${q.id}` }, { label: "Edit" }]} />
      <QuoteForm action={updateQuoteAction.bind(null, id)} options={options} initial={initial} canPickOwner={session.user.viewScope === "all"} submitLabel="Save changes" cancelHref={`/quotes/${id}`} />
    </>
  );
}
