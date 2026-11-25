/** Small, safe readers for list-page query parameters (they come straight from the address bar). */
type P = string | string[] | undefined;

export const text = (v: P): string | undefined => (Array.isArray(v) ? v[0] : v)?.slice(0, 80) || undefined;

export const num = (v: P): number | undefined => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/** yyyy-mm-dd only, so a hand-edited address can never reach the database as a bad date. */
export const isoDate = (v: P): string | undefined => {
  const s = text(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined;
};

export function oneOf<T extends string>(v: P, allowed: readonly T[]): T | undefined {
  const s = text(v);
  return allowed.find((a) => a === s);
}
