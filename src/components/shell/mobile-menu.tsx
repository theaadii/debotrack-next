"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

/** Phone / tablet navigation drawer. The links themselves are passed in from the server. */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto bg-card p-3 shadow-xl" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
            <button type="button" onClick={() => setOpen(false)} className="mb-2 ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted" aria-label="Close menu">
              <X size={18} />
            </button>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
