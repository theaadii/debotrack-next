import Link from "next/link";
import { X } from "lucide-react";
import { SlidersHorizontal } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AutoSubmitForm } from "./auto-submit-form";

export type Chip = { label: string; href: string };

/** One labelled filter inside the panel. */
export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

/**
 * The same filter strip on every list: search, "sort by", a collapsible panel of section-specific filters,
 * and removable chips for whatever is applied. Dropdowns and dates apply as soon as they change.
 */
export function FilterBar({
  basePath,
  hidden,
  search,
  sort,
  chips,
  children,
  extra,
}: {
  basePath: string;
  hidden?: Record<string, string>;
  search: { value?: string; placeholder: string };
  sort: { value: string; options: { value: string; label: string }[] };
  chips: Chip[];
  children?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border p-3 md:p-4">
      <AutoSubmitForm role="search" className="space-y-3">
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className="flex flex-wrap items-center gap-2">
          {children && <input id="filters-open" type="checkbox" className="peer sr-only" defaultChecked={chips.length > 0} />}
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="sr-only">Search</label>
            <Input id="q" name="q" type="search" placeholder={search.placeholder} defaultValue={search.value} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">Sort by</span>
            <Select name="sort" defaultValue={sort.value} aria-label="Sort by" className="w-44">
              {sort.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </label>
          {children && (
            <label htmlFor="filters-open" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted">
              <SlidersHorizontal size={15} aria-hidden /> Filters{chips.length > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-brand-foreground">{chips.length}</span>}
            </label>
          )}
          <Button type="submit" size="md" className="sm:hidden">Apply</Button>
          {extra}
          {children && <div className="order-last hidden w-full gap-3 rounded-xl border border-border bg-muted/30 p-3 peer-checked:grid sm:grid-cols-2 lg:grid-cols-4">{children}</div>}
        </div>
      </AutoSubmitForm>
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <Link key={c.label} href={c.href} className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand hover:opacity-80" aria-label={`Remove filter ${c.label}`}>
              {c.label} <X size={12} aria-hidden />
            </Link>
          ))}
          <Link href={basePath + (hidden?.view ? `?view=${hidden.view}` : "")} className="text-xs font-semibold text-muted-foreground hover:underline">Clear all</Link>
        </div>
      )}
    </div>
  );
}

/** Removable chips for the applied filters; each link drops just that filter (and goes back to page 1). */
export function buildChips(basePath: string, sp: Record<string, string | string[] | undefined>, defs: { key: string; label: string; value?: string }[]): Chip[] {
  const chips: Chip[] = [];
  for (const d of defs) {
    if (!d.value) continue;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === d.key || k === "page" || k === "saved") continue;
      if (typeof v === "string" && v) params.set(k, v);
    }
    const qs = params.toString();
    chips.push({ label: `${d.label}: ${d.value}`, href: qs ? `${basePath}?${qs}` : basePath });
  }
  return chips;
}
