"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const MESSAGES: Record<string, string> = {
  created: "Created.",
  updated: "Saved.",
  deleted: "Deleted.",
  saved: "Saved.",
  imported: "Import finished.",
  password: "Password changed.",
};

/** Shows a toast for `?saved=…` (set by an action's redirect), then removes it from the address. */
export function Flash() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const saved = params.get("saved");
  const problem = params.get("error");

  useEffect(() => {
    if (!saved && !problem) return;
    if (problem) toast.error(problem.slice(0, 200));
    else if (saved) toast.success(MESSAGES[saved] ?? "Done.");
    const next = new URLSearchParams(params.toString());
    next.delete("saved");
    next.delete("error");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [saved, problem, params, pathname, router]);

  return null;
}
