/** Shared input checks for forms and imports. Each returns a message, or null when the value is fine. */

export const LIMITS = { name: 120, short: 200, email: 254, long: 2000 } as const;

const PHONE_CHARS = /^\+?[\d\s().-]+$/;
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function phoneProblem(raw: string): string | null {
  if (!PHONE_CHARS.test(raw)) return `"${clip(raw)}" is not a phone number. Use digits only (a leading + is fine).`;
  const n = raw.replace(/\D/g, "").length;
  if (n < 7 || n > 15) return `"${clip(raw)}" should have 7 to 15 digits.`;
  return null;
}

export function emailProblem(raw: string): string | null {
  if (raw.length > LIMITS.email || !EMAIL.test(raw)) return `"${clip(raw)}" is not a valid email address.`;
  return null;
}

/** First problem among a list of phones / emails, for one field. */
export function listProblem(values: string[], check: (v: string) => string | null, max = 5): string | null {
  if (values.length > max) return `Enter at most ${max} values.`;
  for (const v of values) {
    const p = check(v);
    if (p) return p;
  }
  return null;
}

export function tooLong(value: string | null | undefined, max: number, label: string): string | null {
  return value && value.length > max ? `${label} can be at most ${max} characters.` : null;
}

/** Checks several optional text fields against one limit; returns {field: message}. */
export function lengthErrors(fields: Record<string, [string | null | undefined, number, string]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, [value, max, label]] of Object.entries(fields)) {
    const p = tooLong(value, max, label);
    if (p) out[key] = p;
  }
  return out;
}

function clip(s: string) {
  return s.length > 30 ? `${s.slice(0, 30)}…` : s;
}

/** A date between two years ago and ten years ahead (anything else is almost certainly a typo). */
export function dateProblem(raw: string, { allowPast = true }: { allowPast?: boolean } = {}): string | null {
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return "Enter a valid date.";
  const now = Date.now();
  const year = 365 * 864e5;
  if (t > now + 10 * year) return "That date is too far ahead.";
  if (t < now - (allowPast ? 20 : 0) * year - (allowPast ? 0 : 864e5)) return allowPast ? "That date is too far back." : "That date is in the past.";
  return null;
}

/** The checks every learner form shares (enquiry form, learner form). */
export function learnerErrors(l: { name: string; phones: string[]; emails: string[]; college: string; branch: string | null; city: string | null; qualification: string | null }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!l.name) errors.name = "Enter the learner's name.";
  else if (l.name.length > LIMITS.name) errors.name = `The name can be at most ${LIMITS.name} characters.`;
  if (l.phones.length === 0 && l.emails.length === 0) errors.phone = "Enter a phone number or an email.";
  const phone = listProblem(l.phones, phoneProblem);
  if (phone) errors.phone = phone;
  const email = listProblem(l.emails, emailProblem);
  if (email) errors.email = email;
  Object.assign(
    errors,
    lengthErrors({
      college: [l.college, LIMITS.short, "The college"],
      branch: [l.branch, LIMITS.short, "The branch"],
      city: [l.city, LIMITS.short, "The city"],
      qualification: [l.qualification, LIMITS.short, "The qualification"],
    }),
  );
  return errors;
}
