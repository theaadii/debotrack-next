import { Badge } from "@/components/ui/card";

/** New = outline, in progress = black/white, enrolled = green, not interested = muted dashed. */
export function StageBadge({ name, kind }: { name: string; kind: "open" | "won" | "lost" }) {
  const tone = kind === "won" ? "brand" : kind === "lost" ? "muted" : name.toLowerCase() === "new" ? "neutral" : "solid";
  return <Badge tone={tone}>{name}</Badge>;
}
