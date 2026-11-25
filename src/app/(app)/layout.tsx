import { Suspense } from "react";
import { Shell } from "./shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
