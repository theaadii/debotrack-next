/** Digits only. */
export function digits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** The last 10 digits (a number may be saved as "+91 98765 43210" or "9876543210" — both match). */
export function phoneKey(raw: string): string | null {
  const d = digits(raw);
  if (d.length < 7) return null;
  return d.slice(-10);
}

export function emailKey(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return e.includes("@") ? e : null;
}

/** "98765 43210, 90000 00001" / "a; b" / one per line → separate values. */
export function splitList(raw: string): string[] {
  return raw
    .split(/[,;\n/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function keysFor(phones: string[], emails: string[]) {
  return {
    phoneKeys: [...new Set(phones.map(phoneKey).filter((k): k is string => !!k))],
    emailKeys: [...new Set(emails.map(emailKey).filter((k): k is string => !!k))],
  };
}
