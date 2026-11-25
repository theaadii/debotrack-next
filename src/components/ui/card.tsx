import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // "p-0" means flush: it must also cancel the wider-screen padding.
  const flush = /(^|\s)p-0(\s|$)/.test(className ?? "");
  return <div className={cn("rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 hover:border-brand/40", flush ? "" : "p-4 md:p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-bold", className)} {...props} />;
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "brand" | "solid" | "muted" | "danger" }) {
  const tones = {
    neutral: "border border-border text-foreground",
    brand: "bg-brand text-brand-foreground",
    solid: "bg-foreground text-background",
    muted: "border border-dashed border-border bg-muted text-muted-foreground",
    danger: "bg-danger text-white",
  } as const;
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}
