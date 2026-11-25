"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";

/**
 * Behaviour every create / edit form shares:
 *  - focuses the first field on open (not on touch screens, where it would pop the keyboard up),
 *  - after a failed save, scrolls to and focuses the first field with an error,
 *  - warns before the page is closed or left while there are unsaved changes,
 *  - Ctrl / ⌘ + Enter saves.
 */
export function useFormBehaviour(ref: RefObject<HTMLFormElement | null>, state: FormState, pending: boolean) {
  const dirty = useRef(false);
  const submitted = useRef(false);

  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    if (!window.matchMedia("(pointer: coarse)").matches && !state.values) {
      form.querySelector<HTMLElement>("input:not([type=hidden]):not([readonly]):not([disabled]), select:not([disabled]), textarea")?.focus({ preventScroll: true });
    }
    const markDirty = () => {
      dirty.current = true;
    };
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current && !submitted.current) e.preventDefault();
    };
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        form.requestSubmit();
      }
    };
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    form.addEventListener("keydown", keys);
    window.addEventListener("beforeunload", warn);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
      form.removeEventListener("keydown", keys);
      window.removeEventListener("beforeunload", warn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pending) submitted.current = true;
  }, [pending]);

  // A save that came back with errors: the person is still editing.
  useEffect(() => {
    if (!state.error && !state.fieldErrors) return;
    submitted.current = false;
    const form = ref.current;
    const first = form?.querySelector<HTMLElement>("[aria-invalid=true]");
    if (first) {
      first.scrollIntoView({ block: "center", behavior: "smooth" });
      first.focus({ preventScroll: true });
    } else {
      form?.querySelector("[role=alert]")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state, ref]);

  return dirty;
}

/** The red box at the top of a form: the general message, and a link to every field that needs attention. */
export function ErrorSummary({ state }: { state: FormState }) {
  const fields = Object.entries(state.fieldErrors ?? {});
  if (!state.error && fields.length === 0) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
      <p className="font-semibold">{state.error ?? "Please fix the highlighted fields."}</p>
      {fields.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
          {fields.map(([name, msg]) => (
            <li key={name}>
              <button
                type="button"
                className="text-left underline underline-offset-2"
                onClick={() => {
                  const el = document.getElementById(name) ?? document.querySelector<HTMLElement>(`[name="${name}"]`);
                  el?.scrollIntoView({ block: "center", behavior: "smooth" });
                  el?.focus({ preventScroll: true });
                }}
              >
                {msg}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Save / Cancel kept in view at the bottom, above the footer, so a long form never needs a scroll to submit. */
export function ActionBar({ pending, submitLabel, cancelHref, danger, dirty }: { pending: boolean; submitLabel: string; cancelHref?: string; danger?: boolean; dirty?: RefObject<boolean> }) {
  return (
    <div className="sticky bottom-[var(--footer-h)] z-10 -mx-3 mt-2 flex flex-wrap items-center gap-3 border-t border-border bg-background px-3 py-3 md:-mx-5 md:px-5">
      <Button type="submit" disabled={pending} variant={danger ? "danger" : "primary"} aria-busy={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      {cancelHref && (
        <ButtonLink
          href={cancelHref}
          variant="secondary"
          onClick={(e: React.MouseEvent) => {
            if (dirty?.current && !window.confirm("Leave without saving? What you typed will be lost.")) e.preventDefault();
          }}
        >
          Cancel
        </ButtonLink>
      )}
      <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
        <span aria-hidden className="text-danger">*</span> required · Ctrl+Enter to save
      </span>
    </div>
  );
}
