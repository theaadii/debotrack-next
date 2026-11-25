import Image from "next/image";
import { LoginStage } from "./login/login-stage";

/** The card shared by the forgot-password and reset-password pages. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <LoginStage>
      <div className="login-rise rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-card)] backdrop-blur md:p-8">
        <div className="mb-6 flex">
          <Image src="/brand/logo-light.png" alt="deboTrack" width={140} height={50} priority className="h-14 w-auto dark:hidden" />
          <Image src="/brand/logo-dark.png" alt="deboTrack" width={140} height={50} priority className="hidden h-14 w-auto dark:block" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {children}
      </div>
    </LoginStage>
  );
}
