"use client";

import { useRef, type ReactNode } from "react";

/** Full-screen backdrop: drifting glows, a faint grid and a soft spotlight that follows the pointer. */
export function LoginStage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mx", `${e.clientX}px`);
    el.style.setProperty("--my", `${e.clientY}px`);
    const c = card.current;
    if (c) {
      const r = c.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      c.style.transform = `perspective(900px) rotateX(${(-dy * 6).toFixed(2)}deg) rotateY(${(dx * 6).toFixed(2)}deg)`;
    }
  }

  function onLeave() {
    if (card.current) card.current.style.transform = "";
  }

  return (
    <main
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-canvas p-4"
    >
      <div aria-hidden className="login-blob-a absolute -left-[10%] -top-[20%] -z-10 size-[42rem] rounded-full bg-brand/15 blur-3xl" />
      <div aria-hidden className="login-blob-b absolute -bottom-[25%] -right-[10%] -z-10 size-[38rem] rounded-full bg-brand/10 blur-3xl" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(circle_at_var(--mx,50%)_var(--my,50%),black,transparent_55%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [background:radial-gradient(420px_circle_at_var(--mx,50%)_var(--my,50%),color-mix(in_srgb,var(--brand)_10%,transparent),transparent_70%)]"
      />
      <div ref={card} className="w-full max-w-sm transition-transform duration-200 ease-out will-change-transform">
        {children}
      </div>
    </main>
  );
}
