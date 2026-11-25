"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { leadSources, leadTypes, leads, pipelineStages, roles, sessions, users } from "@/db/schema";
import { passwordProblem, requireSession } from "@/lib/auth";
import { createLogin, deleteLogin, updateLogin } from "@/lib/supabase";
import { echo, type FormState } from "@/lib/form-state";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { optionalInt, str, tidy } from "@/lib/utils";
import { emailProblem, LIMITS, tooLong } from "@/lib/validate";
import { announceNotice, clearNotice } from "@/server/notice";

async function guard(permission: string) {
  const s = await requireSession();
  if (!s.can(permission)) redirect("/forbidden");
  return s;
}
const back = (path: string, params: Record<string, string>) => redirect(`${path}?${new URLSearchParams(params)}`);

// ------------------------------------------------------------------ users
export async function saveUserAction(id: number | null, _prev: FormState, form: FormData): Promise<FormState> {
  const me = await guard("settings.users");
  const errors: Record<string, string> = {};
  const name = tidy(str(form, "name"));
  const email = str(form, "email").toLowerCase();
  const roleId = optionalInt(form, "role_id");
  const password = str(form, "password");
  const active = form.get("active") === "on";

  if (!name) errors.name = "Enter the name.";
  else if (name.length > LIMITS.name) errors.name = `The name can be at most ${LIMITS.name} characters.`;
  const emailErr = email ? emailProblem(email) : "Enter the email address.";
  if (emailErr) errors.email = emailErr;
  if (!roleId) errors.role_id = "Choose a role.";
  if (!id && !password) errors.password = "Set a password.";
  if (password) {
    const problem = passwordProblem(password);
    if (problem) errors.password = problem;
  }
  if (!errors.email) {
    const [dup] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email}`, id ? ne(users.id, id) : undefined)).limit(1);
    if (dup) errors.email = "Another user already has this email.";
  }
  if (id === me.user.id && !active) errors.active = "You can't deactivate your own account.";
  if (Object.keys(errors).length) return { fieldErrors: errors, error: "Please fix the highlighted fields.", values: { ...echo(form), password: "" } };

  if (id) {
    // Never leave the system without an active administrator.
    const [role] = await db.select({ type: roles.permissionType }).from(roles).where(eq(roles.id, roleId!)).limit(1);
    if (role?.type !== "all" || !active) {
      const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).where(and(eq(roles.permissionType, "all"), eq(users.active, true), ne(users.id, id)));
      if (n === 0) return { error: "This is the only active administrator, so it must stay an active administrator.", values: { ...echo(form), password: "" } };
    }
    const [cur] = await db.select({ email: users.email, authId: users.authId }).from(users).where(eq(users.id, id)).limit(1);
    let authId = cur?.authId ?? null;
    if (!authId) {
      // A user not yet linked to a Supabase login (e.g. created before the move): make one now.
      if (!password) return { fieldErrors: { password: "Set a password for this user." }, error: "Please fix the highlighted fields.", values: { ...echo(form), password: "" } };
      const made = await createLogin(email, password);
      if (!made.ok) return { fieldErrors: { email: made.error }, error: "Please fix the highlighted fields.", values: { ...echo(form), password: "" } };
      authId = made.id;
    } else if (password || email !== cur?.email) {
      const err = await updateLogin(authId, { ...(password ? { password } : {}), ...(email !== cur?.email ? { email } : {}) });
      if (err) return { fieldErrors: { [password && !err.includes("email") ? "password" : "email"]: err }, error: "Please fix the highlighted fields.", values: { ...echo(form), password: "" } };
    }
    await db.update(users).set({ name, email, roleId: roleId!, active, authId }).where(eq(users.id, id));
    // A deactivated user, or one whose password was reset, is signed out everywhere.
    if (!active || password) await db.delete(sessions).where(eq(sessions.userId, id));
  } else {
    const made = await createLogin(email, password);
    if (!made.ok) return { fieldErrors: { email: made.error }, error: "Please fix the highlighted fields.", values: { ...echo(form), password: "" } };
    try {
      await db.insert(users).values({ name, email, roleId: roleId!, active, authId: made.id });
    } catch (e) {
      await deleteLogin(made.id); // don't leave an orphan login behind
      throw e;
    }
  }
  revalidatePath("/settings/users");
  redirect("/settings/users?saved=saved");
}

/** Removes a user. Their enquiries, learners and quotes stay (they just lose the owner); they are signed out and can never sign in again. */
export async function deleteUserAction(id: number) {
  const me = await guard("settings.users");
  if (id === me.user.id) back("/settings/users", { error: "You can't delete your own account." });
  const [target] = await db.select({ id: users.id, authId: users.authId, active: users.active, type: roles.permissionType }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).where(eq(users.id, id)).limit(1);
  if (!target) back("/settings/users", { error: "This user no longer exists." });
  if (target!.type === "all" && target!.active) {
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).where(and(eq(roles.permissionType, "all"), eq(users.active, true), ne(users.id, id)));
    if (n === 0) back("/settings/users", { error: "This is the only active administrator, so it can't be deleted." });
  }
  await db.delete(users).where(eq(users.id, id));
  if (target!.authId) await deleteLogin(target!.authId);
  revalidatePath("/settings/users");
  redirect("/settings/users?saved=deleted");
}

// ------------------------------------------------------------------ roles
export async function saveRoleAction(id: number | null, _prev: FormState, form: FormData): Promise<FormState> {
  await guard("settings.roles");
  const name = tidy(str(form, "name"));
  if (!name) return { fieldErrors: { name: "Enter the role name." }, values: echo(form) };
  const lenErr = tooLong(name, LIMITS.name, "The role name") ?? tooLong(str(form, "description"), LIMITS.long, "The description");
  if (lenErr) return { fieldErrors: { [tooLong(name, LIMITS.name, "x") ? "name" : "description"]: lenErr }, values: echo(form) };
  const [dup] = await db.select({ id: roles.id }).from(roles).where(and(sql`lower(${roles.name}) = lower(${name})`, id ? ne(roles.id, id) : undefined)).limit(1);
  if (dup) return { fieldErrors: { name: "A role with this name already exists." }, values: echo(form) };

  const permissionType = str(form, "permission_type") === "all" ? "all" : "custom";
  const permissions = form.getAll("permissions").filter((p): p is string => typeof p === "string" && ALL_PERMISSIONS.includes(p));
  const viewScope = str(form, "view_scope") === "own" ? "own" : "all";
  if (permissionType === "custom" && permissions.length === 0) return { error: "Tick at least one permission, or choose Full access. A role with nothing ticked can't open anything.", values: echo(form) };
  const values = { name, description: str(form, "description") || null, permissionType, permissions: permissionType === "all" ? [] : permissions, viewScope } as const;

  if (id) {
    if (permissionType !== "all") {
      const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).where(and(eq(roles.permissionType, "all"), eq(users.active, true), ne(roles.id, id)));
      const [current] = await db.select({ type: roles.permissionType }).from(roles).where(eq(roles.id, id)).limit(1);
      if (current?.type === "all" && n === 0) return { error: "This role is the only way to have an administrator, so it must keep full access.", values: echo(form) };
    }
    await db.update(roles).set(values).where(eq(roles.id, id));
  } else {
    await db.insert(roles).values(values);
  }
  revalidatePath("/settings/roles");
  redirect("/settings/roles?saved=saved");
}

export async function deleteRoleAction(id: number) {
  await guard("settings.roles");
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(users).where(eq(users.roleId, id));
  if (n > 0) back("/settings/roles", { error: `${n} user(s) still have this role. Move them to another role first.` });
  await db.delete(roles).where(eq(roles.id, id));
  revalidatePath("/settings/roles");
  redirect("/settings/roles?saved=deleted");
}

// ------------------------------------------------------------------ pipeline stages, sources, lead types
const PIPE = "/settings/pipeline";

export async function saveStageAction(id: number | null, form: FormData) {
  await guard("settings.pipeline");
  const name = str(form, "name");
  const kind = (["open", "won", "lost"] as const).find((k) => k === str(form, "kind")) ?? "open";
  const probability = Math.min(100, Math.max(0, optionalInt(form, "probability") ?? 0));
  const sortOrder = optionalInt(form, "sort_order") ?? 99;
  if (!name) back(PIPE, { error: "Enter the status name." });

  if (id) {
    // At least one open, one won and one lost status must remain.
    const [cur] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, id)).limit(1);
    if (cur && cur.kind !== kind) {
      const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(pipelineStages).where(and(eq(pipelineStages.kind, cur.kind), ne(pipelineStages.id, id)));
      if (n === 0) back(PIPE, { error: `At least one "${cur.kind}" status must remain.` });
    }
    await db.update(pipelineStages).set({ name, kind, probability, sortOrder }).where(eq(pipelineStages.id, id));
  } else {
    await db.insert(pipelineStages).values({ name, kind, probability, sortOrder });
  }
  revalidatePath(PIPE);
  revalidatePath("/leads");
  redirect(`${PIPE}?saved=saved`);
}

export async function deleteStageAction(id: number) {
  await guard("settings.pipeline");
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(leads).where(eq(leads.stageId, id));
  if (n > 0) back(PIPE, { error: `${n} enquiries are in this status. Move them first.` });
  const [cur] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, id)).limit(1);
  if (cur) {
    const [{ m } = { m: 0 }] = await db.select({ m: count() }).from(pipelineStages).where(and(eq(pipelineStages.kind, cur.kind), ne(pipelineStages.id, id)));
    if (m === 0) back(PIPE, { error: `At least one "${cur.kind}" status must remain.` });
  }
  await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
  revalidatePath(PIPE);
  redirect(`${PIPE}?saved=deleted`);
}

async function saveNamed(table: typeof leadSources | typeof leadTypes, id: number | null, form: FormData) {
  await guard("settings.pipeline");
  const name = str(form, "name");
  if (!name) back(PIPE, { error: "Enter a name." });
  const [dup] = await db.select({ id: table.id }).from(table).where(and(sql`lower(${table.name}) = lower(${name})`, id ? ne(table.id, id) : undefined)).limit(1);
  if (dup) back(PIPE, { error: `"${name}" already exists.` });
  if (id) await db.update(table).set({ name }).where(eq(table.id, id));
  else await db.insert(table).values({ name });
  revalidatePath(PIPE);
  redirect(`${PIPE}?saved=saved`);
}
export async function saveSourceAction(id: number | null, form: FormData) {
  return saveNamed(leadSources, id, form);
}
export async function saveTypeAction(id: number | null, form: FormData) {
  return saveNamed(leadTypes, id, form);
}

export async function deleteSourceAction(id: number) {
  await guard("settings.pipeline");
  await db.delete(leadSources).where(eq(leadSources.id, id));
  revalidatePath(PIPE);
  redirect(`${PIPE}?saved=deleted`);
}
export async function deleteTypeAction(id: number) {
  await guard("settings.pipeline");
  await db.delete(leadTypes).where(eq(leadTypes.id, id));
  revalidatePath(PIPE);
  redirect(`${PIPE}?saved=deleted`);
}

// ------------------------------------------------------------------ shutdown notice
export async function announceNoticeAction(form: FormData) {
  await guard("notice.manage");
  const minutes = Math.min(240, Math.max(1, optionalInt(form, "minutes") ?? 10));
  await announceNotice(minutes, str(form, "message"));
  revalidatePath("/settings/notice");
  redirect("/settings/notice?saved=saved");
}

export async function clearNoticeAction() {
  await guard("notice.manage");
  await clearNotice();
  revalidatePath("/settings/notice");
  redirect("/settings/notice?saved=saved");
}
