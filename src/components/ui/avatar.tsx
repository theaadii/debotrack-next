import { cn, initials, niceName } from "@/lib/utils";

/** The person's initials in a soft circle: a quiet anchor for the eye in lists and headers. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand", className)}>
      {initials(niceName(name)) || "?"}
    </span>
  );
}
