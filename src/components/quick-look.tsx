"use client";

import Link from "next/link";
import { Mail, MapPin, GraduationCap, Phone, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/avatar";
import { niceName } from "@/lib/utils";

export type QuickLookData = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  college?: string | null;
  branch?: string | null;
  year?: string | null;
  city?: string | null;
  owner?: string | null;
  added?: string | null;
  badge?: React.ReactNode;
  /** Small facts shown as a row of numbers, e.g. enquiries. */
  stats?: { label: string; value: string }[];
  canCreateEnquiry?: boolean;
};

/**
 * Wraps a learner's avatar + name in a list. Hover (mouse) or tap the avatar (touch) to peek at their details
 * without leaving the page; Esc or a click elsewhere closes it. Everything shown is already on the row, so nothing is fetched.
 */
export function QuickLook({ data, children }: { data: QuickLookData; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const root = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function show() {
    clearTimeout(timer.current);
    const el = root.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const w = Math.min(336, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      const below = r.bottom + 8;
      const top = below + 260 > window.innerHeight ? Math.max(8, r.top - 268) : below;
      setPos({ top, left });
    }
    setOpen(true);
  }
  const hide = (delay = 150) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), delay);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const place = [data.college, [data.branch, data.year].filter(Boolean).join(" · ")].filter(Boolean);

  return (
    <span
      ref={root}
      className="relative flex items-center gap-3"
      onMouseEnter={(e) => e.nativeEvent instanceof MouseEvent && window.matchMedia("(hover: hover)").matches && (clearTimeout(timer.current), (timer.current = setTimeout(show, 350)))}
      onMouseLeave={() => hide()}
    >
      <button type="button" onClick={() => (open ? setOpen(false) : show())} aria-label={`Quick look: ${data.name}`} aria-expanded={open} className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <Avatar name={data.name} />
      </button>
      {children}

      {open && createPortal(
        <div
          role="dialog"
          aria-label={`${data.name}, quick look`}
          style={{ top: pos.top, left: pos.left, width: "min(21rem, calc(100vw - 1rem))" }}
          onMouseEnter={() => clearTimeout(timer.current)}
          onMouseLeave={() => hide()}
          className="fixed z-[100] rounded-2xl border border-border bg-card p-4 text-sm text-foreground shadow-xl [animation:login-fade_0.15s_ease-out_both]"
        >
          <div className="flex items-start gap-3">
            <Avatar name={data.name} className="h-11 w-11 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{niceName(data.name)}</p>
              {data.badge && <div className="mt-1">{data.badge}</div>}
            </div>
          </div>

          <ul className="mt-3 space-y-1.5 text-[13px]">
            {data.phone && <li className="flex items-center gap-2"><Phone size={14} className="shrink-0 text-muted-foreground" aria-hidden /><a href={`tel:${data.phone}`} className="tabular-nums hover:text-brand hover:underline">{data.phone}</a></li>}
            {data.email && <li className="flex items-center gap-2"><Mail size={14} className="shrink-0 text-muted-foreground" aria-hidden /><a href={`mailto:${data.email}`} className="truncate hover:text-brand hover:underline">{data.email}</a></li>}
            {place.length > 0 && <li className="flex items-start gap-2"><GraduationCap size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden /><span>{place.map((p, i) => <span key={i} className={i ? "block text-muted-foreground" : "block"}>{p}</span>)}</span></li>}
            {data.city && <li className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-muted-foreground" aria-hidden />{data.city}</li>}
            {data.owner && <li className="flex items-center gap-2"><UserRound size={14} className="shrink-0 text-muted-foreground" aria-hidden />Counsellor: {data.owner}</li>}
          </ul>

          {data.stats && data.stats.length > 0 && (
            <dl className="mt-3 grid grid-flow-col gap-2 border-t border-border pt-3 text-center">
              {data.stats.map((s) => (
                <div key={s.label}><dd className="font-bold tabular-nums">{s.value}</dd><dt className="text-[11px] text-muted-foreground">{s.label}</dt></div>
              ))}
            </dl>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Link href={`/learners/${data.id}`} className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-brand px-3 text-xs font-semibold text-brand-foreground hover:opacity-90">Open profile</Link>
            {data.canCreateEnquiry && <Link href={`/leads/new?learner=${data.id}`} className="inline-flex h-8 items-center whitespace-nowrap rounded-full border border-foreground px-3 text-xs font-semibold hover:bg-brand-tint">Create enquiry</Link>}
            {data.added && <span className="w-full text-[11px] text-muted-foreground">Added {data.added}</span>}
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
