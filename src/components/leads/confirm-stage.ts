type Stage = { id: number; name: string; kind: "open" | "won" | "lost" };

/**
 * Closing an enquiry should be deliberate: Won asks for a confirmation, Lost asks for a reason.
 * Returns what to save, or null when the person backs out.
 */
export function confirmStage(stage: Stage): { reason?: string } | null {
  if (stage.kind === "won") return window.confirm(`Mark this enquiry as “${stage.name}”?`) ? {} : null;
  if (stage.kind === "lost") {
    const reason = window.prompt(`Why is this enquiry “${stage.name}”? (required)`);
    return reason && reason.trim() ? { reason: reason.trim().slice(0, 500) } : null;
  }
  return {};
}
