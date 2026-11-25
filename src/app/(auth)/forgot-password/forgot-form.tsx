"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type ResetState } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(forgotPasswordAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" defaultValue={state.email} required autoFocus />
      </Field>
      {state.error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      {state.done && <p role="status" className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">If that email belongs to an account, a reset link is on its way. Check your inbox (and spam).</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
      <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">Back to sign in</Link>
    </form>
  );
}
