"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmStage } from "./confirm-stage";
import { changeStageAction } from "@/app/(app)/leads/actions";

type Stage = { id: number; name: string; kind: "open" | "won" | "lost" };

function tone(stage: Stage | undefined) {
  if (!stage) return "border-border";
  if (stage.kind === "won") return "border-brand bg-brand text-brand-foreground";
  if (stage.kind === "lost") return "border-dashed border-border bg-muted text-muted-foreground";
  if (stage.name.toLowerCase() === "new") return "border-border bg-transparent text-foreground";
  return "border-foreground bg-foreground text-background";
}

/** The status dropdown: changing it saves straight away. One fixed compact size for every stage. */
export function StageSelect({ leadId, stageId, stages, disabled }: { leadId: number; stageId: number; stages: Stage[]; disabled?: boolean }) {
  const [value, setValue] = useState(stageId);
  const [pending, start] = useTransition();
  const router = useRouter();
  const current = stages.find((s) => s.id === value);

  return (
    <select
      aria-label="Status"
      value={value}
      disabled={disabled || pending}
      onChange={(e) => {
        const next = Number(e.target.value);
        const target = stages.find((x) => x.id === next);
        const previous = value;
        const ok = target ? confirmStage(target) : null;
        if (!ok) {
          setValue(previous);
          return;
        }
        setValue(next);
        start(async () => {
          const res = await changeStageAction(leadId, next, ok.reason);
          if (!res.ok) {
            setValue(previous);
            toast.error(res.error ?? "Could not change the status.");
          } else {
            router.refresh();
          }
        });
      }}
      className={cn("h-[26px] w-32 max-w-full cursor-pointer rounded-full border px-2 text-xs font-semibold disabled:cursor-progress disabled:opacity-60", tone(current))}
    >
      {stages.map((s) => (
        <option key={s.id} value={s.id} className="bg-card text-foreground">
          {s.name}
        </option>
      ))}
    </select>
  );
}
