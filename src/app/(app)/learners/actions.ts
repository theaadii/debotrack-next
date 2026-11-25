"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { colleges, learners } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { echo, type FormState } from "@/lib/form-state";
import { keysFor, splitList } from "@/lib/phone";
import { optional, optionalInt, tidy, str } from "@/lib/utils";
import { learnerErrors, LIMITS, lengthErrors } from "@/lib/validate";
import { parseYear } from "@/lib/year";
import { ensureCollege, findExistingLearner } from "@/server/learner-service";
import { learnerScope } from "@/server/scope";

function read(form: FormData) {
  return {
    name: tidy(str(form, "name")),
    phones: splitList(str(form, "phone")),
    emails: splitList(str(form, "email")),
    college: str(form, "college"),
    branch: optional(form, "branch"),
    year: parseYear(str(form, "year")),
    city: optional(form, "city"),
    qualification: optional(form, "qualification"),
    kind: str(form, "kind") === "professional" ? ("professional" as const) : ("student" as const),
  };
}

function check(l: ReturnType<typeof read>) {
  return learnerErrors(l);
}

export async function createLearnerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.can("learners.manage")) return { error: "You don't have permission to add learners." };
  const l = read(form);
  const fieldErrors = check(l);
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Please fix the highlighted fields.", values: echo(form) };

  const dup = await findExistingLearner(l.phones, l.emails, learnerScope(session));
  if (dup) return { error: "A learner with this phone or email already exists.", fieldErrors: { phone: "Already saved — open that learner instead." }, values: echo(form) };

  const collegeId = await ensureCollege(l.college);
  const ownerId = session.user.viewScope === "all" ? (optionalInt(form, "owner_id") ?? session.user.id) : session.user.id;
  const [row] = await db
    .insert(learners)
    .values({ name: l.name, phones: l.phones, emails: l.emails, ...keysFor(l.phones, l.emails), collegeId, branch: l.branch, year: l.year, city: l.city, qualification: l.qualification, kind: l.kind, ownerId })
    .returning({ id: learners.id });
  revalidatePath("/learners");
  redirect(`/learners/${row!.id}?saved=created`);
}

export async function updateLearnerAction(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.can("learners.manage")) return { error: "You don't have permission to edit learners." };
  const [cur] = await db.select({ id: learners.id }).from(learners).where(and(eq(learners.id, id), learnerScope(session))).limit(1);
  if (!cur) return { error: "This learner no longer exists." };
  const l = read(form);
  const fieldErrors = check(l);
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: "Please fix the highlighted fields.", values: echo(form) };

  const dup = await findExistingLearner(l.phones, l.emails);
  if (dup && dup !== id) return { error: "Another learner already has this phone or email.", fieldErrors: { phone: "Already used by another learner." }, values: echo(form) };

  const collegeId = await ensureCollege(l.college);
  const ownerId = session.user.viewScope === "all" ? (optionalInt(form, "owner_id") ?? null) : undefined;
  await db
    .update(learners)
    .set({ name: l.name, phones: l.phones, emails: l.emails, ...keysFor(l.phones, l.emails), collegeId, branch: l.branch, year: l.year, city: l.city, qualification: l.qualification, kind: l.kind, ...(ownerId !== undefined ? { ownerId } : {}), updatedAt: new Date() })
    .where(eq(learners.id, id));
  revalidatePath("/learners");
  revalidatePath(`/learners/${id}`);
  redirect(`/learners/${id}?saved=updated`);
}

export async function deleteLearnerAction(id: number) {
  const session = await requireSession();
  if (!session.can("learners.manage")) redirect("/forbidden");
  await db.delete(learners).where(and(eq(learners.id, id), learnerScope(session)));
  revalidatePath("/learners");
  revalidatePath("/leads");
  redirect("/learners?saved=deleted");
}

// ---------------------------------------------------------------- colleges
function readCollege(form: FormData) {
  return { name: str(form, "name"), city: optional(form, "city"), website: optional(form, "website") };
}

function collegeErrors(c: ReturnType<typeof readCollege>) {
  const e = lengthErrors({ name: [c.name, LIMITS.short, "The name"], city: [c.city, LIMITS.short, "The city"], website: [c.website, LIMITS.short, "The website"] });
  if (!c.name) e.name = "Enter the name.";
  if (c.website && !/^https?:\/\/\S+$/i.test(c.website)) e.website = "Enter a full web address starting with http:// or https://.";
  return e;
}

export async function createCollegeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.can("learners.manage")) return { error: "You don't have permission to add colleges." };
  const c = readCollege(form);
  const ce = collegeErrors(c);
  if (Object.keys(ce).length) return { fieldErrors: ce, values: echo(form) };
  if (await ensureCollegeExists(c.name)) return { fieldErrors: { name: "This college is already saved." }, values: echo(form) };
  await db.insert(colleges).values(c);
  revalidatePath("/colleges");
  redirect("/colleges?saved=created");
}

/** True when a college with this name (ignoring upper/lower case) already exists, other than `exceptId`. */
async function ensureCollegeExists(name: string, exceptId?: number) {
  const [hit] = await db
    .select({ id: colleges.id })
    .from(colleges)
    .where(and(sql`lower(${colleges.name}) = lower(${name})`, exceptId ? ne(colleges.id, exceptId) : undefined))
    .limit(1);
  return !!hit;
}

export async function updateCollegeAction(id: number, _prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.can("learners.manage")) return { error: "You don't have permission to edit colleges." };
  const c = readCollege(form);
  const ce = collegeErrors(c);
  if (Object.keys(ce).length) return { fieldErrors: ce, values: echo(form) };
  if (await ensureCollegeExists(c.name, id)) return { fieldErrors: { name: "Another college already has this name." }, values: echo(form) };
  await db.update(colleges).set(c).where(eq(colleges.id, id));
  revalidatePath("/colleges");
  redirect("/colleges?saved=updated");
}

export async function deleteCollegeAction(id: number) {
  const session = await requireSession();
  if (!session.can("learners.manage")) redirect("/forbidden");
  await db.delete(colleges).where(eq(colleges.id, id));
  revalidatePath("/colleges");
  revalidatePath("/learners");
  redirect("/colleges?saved=deleted");
}
