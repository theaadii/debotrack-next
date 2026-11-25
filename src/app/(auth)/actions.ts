"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { attemptLogin, destroySession, passwordProblem } from "@/lib/auth";
import { supabaseAdmin, supabaseAnon, updateLogin } from "@/lib/supabase";

export type LoginState = { error?: string; email?: string };

const schema = z.object({ email: z.string().trim().email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details.", email };

  const result = await attemptLogin(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error, email };
  redirect("/dashboard");
}

export type ResetState = { error?: string; email?: string; done?: boolean; fieldErrors?: Record<string, string> };

/** Sends the reset e-mail. Always answers the same, so it can't be used to find out who has an account. */
export async function forgotPasswordAction(_prev: ResetState, form: FormData): Promise<ResetState> {
  const parsed = z.string().trim().email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address.", email: String(form.get("email") ?? "") };
  const email = parsed.data;

  // The Supabase project may hold other people's logins: only e-mail people who have an active account here.
  const [u] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, eq(users.active, true))).limit(1);
  if (u) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    await supabaseAnon().auth.resetPasswordForEmail(email, { redirectTo: `${proto}://${host}/reset-password` });
  }
  return { done: true, email };
}

/** The token is the one-time access token from the e-mail link; Supabase tells us whose it is. */
export async function resetPasswordAction(_prev: ResetState, form: FormData): Promise<ResetState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const errors: Record<string, string> = {};
  const problem = passwordProblem(password);
  if (problem) errors.password = problem;
  if (password !== form.get("confirm")) errors.confirm = "The two passwords don't match.";
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "Please fix the highlighted fields." };

  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return { error: "This reset link is invalid or has expired. Ask for a new one." };
  const [u] = await db.select({ id: users.id, active: users.active }).from(users).where(eq(users.authId, data.user.id)).limit(1);
  if (!u || !u.active) return { error: "This reset link is invalid or has expired. Ask for a new one." };

  const err = await updateLogin(data.user.id, { password });
  if (err) return { error: err };
  await db.delete(sessions).where(eq(sessions.userId, u.id)); // sign out everywhere
  return { done: true };
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
