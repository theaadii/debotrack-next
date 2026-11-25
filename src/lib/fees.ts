export type DiscountType = "percent" | "fixed";

/**
 * Final fee = course fee less the discount (a percentage of it, or a fixed amount).
 * The course fee itself is never changed. Returns null when there is no course fee.
 */
export function computeFinalFee(
  courseFee: number | null | undefined,
  discountType: DiscountType | null | undefined,
  discountValue: number | null | undefined,
): number | null {
  if (courseFee === null || courseFee === undefined || !Number.isFinite(courseFee)) return null;
  const value = discountValue ?? 0;
  if (!discountType || !(value > 0)) return round2(Math.max(0, courseFee));

  const final =
    discountType === "percent" ? courseFee * (1 - Math.min(value, 100) / 100) : courseFee - value;
  return round2(Math.max(0, final));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
