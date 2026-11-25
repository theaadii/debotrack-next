/**
 * Engineering streams call the years FE / SE / TE / BE (and FY / SY / TY for degrees); "final" is the last year (4).
 * Single letters are not accepted outside roman numerals ("I", "II", ...) so ordinary words never match.
 */
const WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, final: 4,
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6,
  fe: 1, se: 2, te: 3, be: 4,
  fy: 1, sy: 2, ty: 3, ly: 4,
  freshman: 1, sophomore: 2, junior: 3, senior: 4,
};

/** "3", "3rd year", "Third", "III", "T.E.", "TE", "Third Year (TE)", "final year" → 3 / 3 / 3 / 3 / 3 / 3 / 3 / 4. Anything else → null. */
export function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/(?<=\b[a-z])\.(?=[a-z]\b)/g, "") // "t.e." → "te"
    .replace(/\./g, "")
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    .replace(/\b(year|yr|yrs|sem|semester)\b/g, " ")
    .replace(/[^a-z0-9]/g, " ")
    .trim();
  if (!s) return null;
  const digit = s.match(/\d+/);
  if (digit) {
    const n = Number(digit[0]);
    return n >= 1 && n <= 6 ? n : null;
  }
  for (const token of s.split(/\s+/)) if (token in WORDS) return WORDS[token]!;
  return null;
}
