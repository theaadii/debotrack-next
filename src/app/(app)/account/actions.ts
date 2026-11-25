"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { passwordProblem, requireSession, verifyPassword } from "@/lib/auth";
import { updateLogin } from "@/lib/supabase";
import type { FormState } from "@/lib/form-state";
import { str } from "@/lib/utils";

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  const current = str(form, "current");
  const next = str(form, "password");
  const confirm = str(form, "confirm");

  const errors: Record<string, string> = {};
  if (!current || !(await verifyPassword(session.user.id, current))) errors.current = "That is not your current password.";
  const problem = passwordProblem(next);
  if (problem) errors.password = problem;
  else if (next === current) errors.password = "Choose a password you haven't used here.";
  if (next !== confirm) errors.confirm = "The two passwords don't match.";
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "Please fix the highlighted fields." };

  const [me] = await db.select({ authId: users.authId }).from(users).where(eq(users.id, session.user.id)).limit(1);
  const err = me?.authId ? await updateLogin(me.authId, { password: next }) : "Your login is not linked yet. Ask an administrator.";
  if (err) return { error: err };
  // Sign out every other device; this one stays signed in.
  const token = (await cookies()).get("dt_session")?.value;
  if (token) await db.delete(sessions).where(and(eq(sessions.userId, session.user.id), ne(sessions.id, createHash("sha256").update(token).digest("hex"))));
  redirect("/account?saved=password");
}
