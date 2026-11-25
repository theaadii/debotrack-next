"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { confirmStage } from "./confirm-stage";
import { changeStageAction } from "@/app/(app)/leads/actions";

type Stage = { id: number; name: string; kind: "open" | "won" | "lost" };

/** The pipeline as a row of steps; click one to move the enquiry there. */
export function StageBar({ leadId, stageId, stages, canEdit }: { leadId: number; stageId: number; stages: Stage[]; canEdit: boolean }) {
  const [value, setValue] = useState(stageId);
  const [pending, start] = useTransition();
  const router = useRouter();
  const currentIndex = stages.findIndex((s) => s.id === value);
  const current = stages[currentIndex];

  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Pipeline status">
      {stages.map((s, i) => {
        const isCurrent = s.id === value;
        const reached = current?.kind === "open" ? s.kind === "open" && i <= currentIndex : isCurrent;
        return (
          <li key={s.id}>
            <button
              type="button"
              disabled={!canEdit || pending}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => {
                if (isCurrent) return;
                const previous = value;
                const ok = confirmStage(s);
                if (!ok) return;
                setValue(s.id);
                start(async () => {
                  const res = await changeStageAction(leadId, s.id, ok.reason);
                  if (!res.ok) {
                    setValue(previous);
                    toast.error(res.error ?? "Could not change the status.");
                  } else router.refresh();
                });
              }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed",
                reached && s.kind === "lost" && "border-border bg-muted text-muted-foreground",
                reached && s.kind !== "lost" && "border-brand bg-brand text-brand-foreground",
                !reached && "border-border hover:bg-muted",
                isCurrent && "ring-2 ring-brand-tint ring-offset-1 ring-offset-background",
              )}
            >
              {s.name}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
