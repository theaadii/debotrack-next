import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { colleges, learners } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { getOptions } from "@/server/options";
import { getLead } from "@/server/leads";
import { learnerScope } from "@/server/scope";
import { PageHeader } from "@/components/ui/page";
import { newItem, QuoteForm, type QuoteFormValues } from "@/components/quotes/quote-form";
import { parseId } from "@/lib/utils";
import { createQuoteAction } from "../actions";

export const metadata: Metadata = { title: "Create quote" };

const inThirtyDays = () => new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

export default async function NewQuotePage({ searchParams }: PageProps<"/quotes/new">) {
  const session = await requirePermission("quotes.create");
  const sp = await searchParams;
  const options = await getOptions();

  const base: QuoteFormValues = {
    subject: "", description: "", expired_at: inThirtyDays(), owner_id: "", lead_id: "", adjustment: "",
    bill_address: "", bill_city: "", bill_state: "", bill_postcode: "", bill_country: "India", recipient_kind: "learner", recipient_name: "", recipient_contact: "", learner: null, items: [],
  };

  // "Create quote" from an enquiry: the learner, the program and batch fee and the enquiry's discount come along.
  const leadId = parseId(sp.lead);
  const lead = Number.isInteger(leadId) && session.can("leads.view") ? await getLead(session, leadId) : null;
  if (lead) {
    const name = lead.program ? (lead.batch ? `${lead.program} · ${lead.batch}` : lead.program) : "";
    base.lead_id = String(lead.id);
    base.subject = name || `Quote for ${lead.learner}`;
    base.learner = { id: lead.learnerId, name: lead.learner, phone: lead.phones[0] ?? "", email: lead.emails[0] ?? "", city: lead.city ?? "" };
    base.bill_city = lead.city ?? "";
    if (name && lead.courseFee) {
      base.items = [
        newItem({
          name,
          price: String(Number(lead.courseFee)),
          discountKind: lead.discountType === "fixed" ? "amount" : "percent",
          discountValue: lead.discountValue ? String(Number(lead.discountValue)) : "",
        }),
      ];
    }
  } else {
    const learnerId = parseId(sp.learner);
    if (Number.isInteger(learnerId)) {
      const [l] = await db
        .select({ id: learners.id, name: learners.name, phones: learners.phones, emails: learners.emails, city: learners.city, college: colleges.name })
        .from(learners)
        .leftJoin(colleges, eq(colleges.id, learners.collegeId))
        .where(and(eq(learners.id, learnerId), learnerScope(session)))
        .limit(1);
      if (l) {
        base.learner = { id: l.id, name: l.name, phone: l.phones[0] ?? "", email: l.emails[0] ?? "", city: l.city ?? "" };
        base.bill_city = l.city ?? "";
      }
    }
  }

  return (
    <>
      <PageHeader title="Create quote" crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Quotes", href: "/quotes" }, { label: "Create" }]} />
      <QuoteForm action={createQuoteAction} options={options} initial={base} canPickOwner={session.user.viewScope === "all"} submitLabel="Save quote" cancelHref={lead ? `/leads/${lead.id}` : "/quotes"} />
    </>
  );
}
