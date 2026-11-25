"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { attemptLogin, destroySession } from "@/lib/auth";

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

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
