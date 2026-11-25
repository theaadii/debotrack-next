"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { connections } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { echo, type FormState } from "@/lib/form-state";
import { optional, str } from "@/lib/utils";
import { emailProblem, lengthErrors, LIMITS, phoneProblem } from "@/lib/validate";
import { ensureCollege } from "@/server/learner-service";

async function guard() {
  const s = await requireSession();
  if (!s.can("connections.manage")) redirect("/forbidden");
  return s;
}

export async function saveConnectionAction(id: number | null, _prev: FormState, form: FormData): Promise<FormState> {
  const session = await guard();
  const errors: Record<string, string> = {};
  const name = str(form, "name");
  const phone = optional(form, "phone");
  const email = optional(form, "email");
  if (!name) errors.name = "Enter the name.";
  if (!phone && !email) errors.phone = "Enter a phone number or an email.";
  if (email) { const p = emailProblem(email); if (p) errors.email = p; }
  if (phone) { const p = phoneProblem(phone); if (p) errors.phone = p; }
  Object.assign(errors, lengthErrors({ name: [name, LIMITS.name, "The name"], designation: [optional(form, "designation"), LIMITS.short, "The designation"], institution: [str(form, "institution"), LIMITS.short, "The institution"], notes: [optional(form, "notes"), LIMITS.long, "The notes"] }));
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "Please fix the highlighted fields.", values: echo(form) };

  const collegeId = await ensureCollege(str(form, "institution"));
  const values = { name, designation: optional(form, "designation"), phone, email, collegeId, notes: optional(form, "notes") };
  if (id) await db.update(connections).set(values).where(eq(connections.id, id));
  else await db.insert(connections).values({ ...values, ownerId: session.user.id });

  revalidatePath("/connections");
  redirect(`/connections?saved=${id ? "updated" : "created"}`);
}

export async function deleteConnectionAction(id: number) {
  await guard();
  await db.delete(connections).where(eq(connections.id, id));
  revalidatePath("/connections");
  redirect("/connections?saved=deleted");
}
