/**
 * Quote arithmetic, shared by the form (live totals) and the server (the figures that are saved).
 * Money is worked in paise (whole numbers) so 0.1 + 0.2 never produces 0.30000000000000004.
 *
 * Same rules as the Laravel quotes: a line is quantity × price, less its discount, plus its tax
 * (tax is worked on the amount after the discount); the quote is the sum of its lines plus an adjustment.
 */
export type DiscountKind = "percent" | "amount";

export type QuoteLineInput = {
  quantity: number;
  price: number;
  discountKind: DiscountKind;
  discountValue: number;
  taxPercent: number;
};

export type QuoteLineResult = {
  amount: number; // quantity × price
  discountAmount: number;
  taxAmount: number;
  total: number; // amount − discount + tax
};

export type QuoteTotals = {
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  adjustmentAmount: number;
  grandTotal: number;
};

const toPaise = (rupees: number) => Math.round((Number.isFinite(rupees) ? rupees : 0) * 100);
const toRupees = (paise: number) => paise / 100;

export function calcLine(line: QuoteLineInput): QuoteLineResult {
  const amount = Math.round(Math.max(0, line.quantity) * toPaise(Math.max(0, line.price)));
  const rawDiscount = line.discountKind === "percent" ? Math.round((amount * Math.min(100, Math.max(0, line.discountValue))) / 100) : toPaise(Math.max(0, line.discountValue));
  const discount = Math.min(amount, rawDiscount);
  const tax = Math.round(((amount - discount) * Math.min(100, Math.max(0, line.taxPercent))) / 100);
  return { amount: toRupees(amount), discountAmount: toRupees(discount), taxAmount: toRupees(tax), total: toRupees(amount - discount + tax) };
}

export function calcQuote(lines: QuoteLineInput[], adjustment: number): QuoteTotals {
  let sub = 0;
  let disc = 0;
  let tax = 0;
  for (const l of lines) {
    const r = calcLine(l);
    sub += toPaise(r.amount);
    disc += toPaise(r.discountAmount);
    tax += toPaise(r.taxAmount);
  }
  const adj = toPaise(adjustment);
  return { subTotal: toRupees(sub), discountAmount: toRupees(disc), taxAmount: toRupees(tax), adjustmentAmount: toRupees(adj), grandTotal: toRupees(sub - disc + tax + adj) };
}
