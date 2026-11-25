"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { resetPasswordAction, type ResetState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/** Supabase's e-mail link lands here with the one-time token in the #fragment, which only the browser can see. */
export function ResetForm() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPasswordAction, {});

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    setToken(p.get("type") === "recovery" ? p.get("access_token") : null);
    history.replaceState(null, "", window.location.pathname); // keep the token out of the address bar
  }, []);

  if (token === undefined) return null;
  if (!token || state.done) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
          {state.done ? "Password changed. You can sign in now." : "This reset link is invalid or has expired. Ask for a new one."}
        </p>
        <Link href={state.done ? "/login" : "/forgot-password"} className="block text-center text-sm font-medium hover:underline">
          {state.done ? "Go to sign in" : "Send a new link"}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password" error={state.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={state.fieldErrors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      {state.error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving…" : "Set password"}</Button>
    </form>
  );
}
