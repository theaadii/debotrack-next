const WORDS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, final: 4, i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };

/** "3", "3rd year", "Third", "III", "final year" → 3 / 3 / 3 / 3 / 4. Anything else → null. */
export function parseYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/\b(year|yr|st|nd|rd|th)\b/g, "").replace(/[^a-z0-9]/g, " ").trim();
  if (!s) return null;
  const digit = s.match(/\d+/);
  if (digit) {
    const n = Number(digit[0]);
    return n >= 1 && n <= 6 ? n : null;
  }
  return WORDS[s.split(/\s+/)[0]!] ?? null;
}
