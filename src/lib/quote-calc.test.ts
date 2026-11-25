import { describe, expect, it } from "vitest";
import { calcLine, calcQuote } from "./quote-calc";

const line = (o: Partial<Parameters<typeof calcLine>[0]> = {}) => ({ quantity: 1, price: 1000, discountKind: "percent" as const, discountValue: 0, taxPercent: 0, ...o });

describe("calcLine", () => {
  it("multiplies quantity by price", () => expect(calcLine(line({ quantity: 3, price: 250 })).total).toBe(750));
  it("takes a percentage discount before tax", () => {
    const r = calcLine(line({ price: 10000, discountValue: 10, taxPercent: 18 }));
    expect(r.discountAmount).toBe(1000);
    expect(r.taxAmount).toBe(1620); // 18% of 9000
    expect(r.total).toBe(10620);
  });
  it("takes a fixed discount", () => expect(calcLine(line({ discountKind: "amount", discountValue: 250 })).total).toBe(750));
  it("never lets the discount exceed the amount", () => expect(calcLine(line({ discountKind: "amount", discountValue: 5000 })).total).toBe(0));
  it("clamps nonsense: negative, over 100% and NaN", () => {
    expect(calcLine(line({ quantity: -2 })).total).toBe(0);
    expect(calcLine(line({ discountValue: 250 })).total).toBe(0);
    expect(calcLine(line({ price: Number.NaN })).total).toBe(0);
  });
  it("has no floating point drift", () => expect(calcLine(line({ quantity: 3, price: 0.1 })).total).toBe(0.3));
});

describe("calcQuote", () => {
  it("adds the lines and the adjustment", () => {
    const t = calcQuote([line({ price: 10000, discountValue: 10, taxPercent: 18 }), line({ quantity: 2, price: 500 })], -20);
    expect(t).toEqual({ subTotal: 11000, discountAmount: 1000, taxAmount: 1620, adjustmentAmount: -20, grandTotal: 11600 });
  });
  it("is zero for no lines", () => expect(calcQuote([], 0).grandTotal).toBe(0));
});
