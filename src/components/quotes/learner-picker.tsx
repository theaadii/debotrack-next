"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/field";
import { niceName } from "@/lib/utils";

export type PickedLearner = { id: number; name: string; phone: string; email: string; city: string };

/** Type-ahead for choosing a learner by name, phone or email. Submits the chosen id as `learner_id`. */
export function LearnerPicker({ value, onChange, error }: { value: PickedLearner | null; onChange: (l: PickedLearner | null) => void; error?: string }) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedLearner[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      fetch(`/api/learners/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: PickedLearner[] }) => {
          setResults(d.results);
          setActive(0);
        })
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const shown = q.trim().length >= 2 ? results : [];
  const pick = (l: PickedLearner) => {
    onChange(l);
    setQ("");
    setOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{niceName(value.name)}</p>
          <p className="truncate text-xs text-muted-foreground">{[value.phone, value.email].filter(Boolean).join(", ") || "No contact details"}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-tint">
          <X size={14} aria-hidden /> Change
        </button>
      </div>
    );
  }

  return (
    <div ref={box} className="relative">
      <Input
        id="learner_search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "learner_search-error" : undefined}
        placeholder="Search by name, phone or email"
        value={q}
        autoComplete="off"
        maxLength={60}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(shown.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && open && shown[active]) {
            e.preventDefault();
            pick(shown[active]!);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && q.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{busy ? "Searching…" : "No learner found. Add them under Learners first."}</li>
          ) : (
            shown.map((r, i) => (
              <li key={r.id} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${i === active ? "bg-brand-tint" : "hover:bg-muted"}`}>
                  <span className="block truncate font-semibold">{niceName(r.name)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[r.phone, r.email].filter(Boolean).join(", ") || "No contact details"}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
