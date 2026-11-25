import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { LoginStage } from "./login-stage";

export const metadata: Metadata = { title: "Sign in" };

/** Someone who is already signed in goes straight to the app. */
async function SignedInRedirect() {
  if (await getSession()) redirect("/dashboard");
  return null;
}

export default function LoginPage() {
  return (
    <LoginStage>
      <div className="login-rise rounded-2xl border border-border bg-card/90 p-6 shadow-[var(--shadow-card)] backdrop-blur md:p-8">
        <div className="login-fade mb-6 flex" style={{ animationDelay: "150ms" }}>
          <Image src="/brand/logo-light.png" alt="deboTrack" width={140} height={50} priority className="h-14 w-auto dark:hidden" />
          <Image src="/brand/logo-dark.png" alt="deboTrack" width={140} height={50} priority className="hidden h-14 w-auto dark:block" />
        </div>
        <h1 className="login-fade text-2xl font-extrabold tracking-tight" style={{ animationDelay: "250ms" }}>Sign in</h1>
        <p className="login-fade mb-5 mt-1 text-sm text-muted-foreground" style={{ animationDelay: "320ms" }}>
          Every enquiry, from the first call to enrolment.
        </p>
        <div className="login-fade" style={{ animationDelay: "400ms" }}>
          <LoginForm />
        </div>
        <Suspense fallback={null}>
          <SignedInRedirect />
        </Suspense>
      </div>
    </LoginStage>
  );
}
