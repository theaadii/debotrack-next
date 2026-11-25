"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Match = { id: number; name: string; phones: string[]; enquiries: number };

/**
 * Sits inside a form and watches its phone / email boxes. When what is typed already belongs to a saved
 * learner, it says so right away — before the form is saved — instead of after.
 */
export function MatchHint({ mode, except }: { mode: "enquiry" | "learner"; except?: number }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctl: AbortController | undefined;

    const check = () => {
      const phone = (form.elements.namedItem("phone") as HTMLInputElement | null)?.value.trim() ?? "";
      const email = (form.elements.namedItem("email") as HTMLInputElement | null)?.value.trim() ?? "";
      if (phone.replace(/\D/g, "").length < 7 && !email.includes("@")) {
        setMatch(null);
        return;
      }
      ctl?.abort();
      ctl = new AbortController();
      const q = new URLSearchParams({ phone, email });
      if (except) q.set("except", String(except));
      fetch(`/api/learners/match?${q}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { match: null }))
        .then((d: { match: Match | null }) => setMatch(d.match))
        .catch(() => {});
    };
    const onInput = (e: Event) => {
      const name = (e.target as HTMLInputElement).name;
      if (name !== "phone" && name !== "email") return;
      clearTimeout(timer);
      timer = setTimeout(check, 400);
    };
    form.addEventListener("input", onInput);
    check();
    return () => {
      form.removeEventListener("input", onInput);
      clearTimeout(timer);
      ctl?.abort();
    };
  }, [except]);

  return (
    <div ref={anchor} aria-live="polite" className={match ? "md:col-span-2" : "hidden"}>
      {match && (
        <p className="rounded-lg border border-brand/40 bg-brand-tint px-3 py-2 text-sm">
          <strong>{match.name}</strong> ({match.phones.join(", ")}) is already saved
          {match.enquiries > 0 && <> with {match.enquiries} enquir{match.enquiries === 1 ? "y" : "ies"}</>}.{" "}
          {mode === "enquiry" ? "Saving will add this enquiry to them instead of creating a duplicate. " : "A second learner with this phone or email can't be saved. "}
          <Link href={`/learners/${match.id}`} target="_blank" className="font-semibold text-brand underline">
            Open learner
          </Link>
        </p>
      )}
    </div>
  );
}
