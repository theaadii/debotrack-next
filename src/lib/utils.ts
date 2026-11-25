import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not set";
  const n = Number(value);
  return Number.isFinite(n) ? inr.format(n) : "—";
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "Not set";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "Not set";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function yearLabel(year: number | null | undefined): string {
  if (!year) return "Not set";
  const suffix = year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th";
  return `${year}${suffix} Year`;
}

/** Collapses runs of whitespace into single spaces ("  Asha   Rao " → "Asha Rao"). */
export function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Reads a form value as a trimmed string ("" when missing). */
export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optional(form: FormData, key: string): string | null {
  const v = str(form, key);
  return v === "" ? null : v;
}

export function optionalInt(form: FormData, key: string): number | null {
  const v = str(form, key);
  if (v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function optionalNumber(form: FormData, key: string): number | null {
  const v = str(form, key).replace(/,/g, "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** A record id from a URL segment: a positive integer that fits the database, otherwise NaN (callers answer 404). */
export function parseId(raw: unknown): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return typeof s === "string" && /^[1-9]\d{0,8}$/.test(s) ? Number(s) : Number.NaN;
}

/**
 * How a person's name is shown. Names pasted from sheets are often ALL CAPS or all lower case, which
 * reads as shouting in a list; those are shown in Title Case. A name someone typed with mixed case is left alone,
 * and nothing stored is changed.
 */
export function niceName(name: string | null | undefined): string {
  if (!name) return "";
  const hasLetters = /\p{L}/u.test(name);
  if (!hasLetters || (name !== name.toUpperCase() && name !== name.toLowerCase())) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'’.(])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Enquiry titles built from a learner's name ("ASHA RAO - Enquiry") read as "Enquiry for Asha Rao". */
export function niceTitle(title: string | null | undefined): string {
  if (!title) return "";
  const m = /^(.+) - Enquiry$/.exec(title);
  return m ? `Enquiry for ${niceName(m[1])}` : title;
}
