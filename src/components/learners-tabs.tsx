import Link from "next/link";
import { cn } from "@/lib/utils";

/** Learners and Schools & Colleges live under one sidebar entry, as two tabs. */
export function LearnersTabs({ active }: { active: "learners" | "colleges" }) {
  const tab = "rounded-full px-4 py-1.5 text-sm font-semibold";
  return (
    <nav className="mb-3 inline-flex gap-1 rounded-full border border-border p-1" aria-label="Learners sections">
      <Link href="/learners" aria-current={active === "learners" ? "page" : undefined} className={cn(tab, active === "learners" ? "bg-brand text-brand-foreground" : "hover:bg-muted")}>
        Learners
      </Link>
      <Link href="/colleges" aria-current={active === "colleges" ? "page" : undefined} className={cn(tab, active === "colleges" ? "bg-brand text-brand-foreground" : "hover:bg-muted")}>
        Schools &amp; Colleges
      </Link>
    </nav>
  );
}
