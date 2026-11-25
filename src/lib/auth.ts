import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts, roles, sessions, users } from "@/db/schema";
import { hasPermission } from "./permissions";
import { supabaseAnon } from "./supabase";

const COOKIE = "dt_session";
const SESSION_HOURS = 12;
const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  roleName: string;
  permissionType: "all" | "custom";
  permissions: string[];
  viewScope: "all" | "own";
};

export type Session = { user: SessionUser; can: (key: string) => boolean };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** The signed-in user for this request, or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: users.id,
      name: users.name,
      email: users.email,
      active: users.active,
      roleName: roles.name,
      permissionType: roles.permissionType,
      permissions: roles.permissions,
      viewScope: roles.viewScope,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);

  if (!row || !row.active) return null;

  const user: SessionUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    roleName: row.roleName,
    permissionType: row.permissionType,
    permissions: row.permissions,
    viewScope: row.viewScope,
  };
  return { user, can: (key) => hasPermission(user, key) };
});

/** Pages: redirect to the login page when signed out. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Pages: also require a permission, otherwise show the "not allowed" page. */
export async function requirePermission(key: string): Promise<Session> {
  const s = await requireSession();
  if (!s.can(key)) redirect("/forbidden");
  return s;
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  const h = await headers();

  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    ip: await clientIp(),
    userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  // Housekeeping: forget sessions that ended more than a day ago.
  await db.delete(sessions).where(lt(sessions.expiresAt, sql`now() - interval '1 day'`));

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** Password rules for new passwords. Returns an error message, or null when fine. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  // Supabase Auth (bcrypt) only reads the first 72 bytes, so a longer password would be silently cut short.
  if (new TextEncoder().encode(pw).length > 72) return "Use at most 72 characters.";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return "Use upper-case, lower-case letters and a number.";
  return null;
}

type LoginResult = { ok: true } | { ok: false; error: string };

/** Checks the credentials, with a lock-out after repeated failures (per email+IP, and per IP). */
export async function attemptLogin(email: string, password: string): Promise<LoginResult> {
  const ip = await clientIp();
  const keys = [`${email.toLowerCase()}|${ip}`, `ip|${ip}`];

  const since = sql`now() - make_interval(mins => ${WINDOW_MINUTES})`;
  const [perPair] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, keys[0]!), gt(loginAttempts.createdAt, since)));
  const [perIp] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, keys[1]!), gt(loginAttempts.createdAt, since)));

  if ((perPair?.n ?? 0) >= MAX_FAILURES || (perIp?.n ?? 0) >= MAX_FAILURES * 4) {
    return { ok: false, error: `Too many attempts. Try again in ${WINDOW_MINUTES} minutes.` };
  }

  // Always ask Supabase, even for an unknown email, so both failures take about the same time.
  const { data, error } = await supabaseAnon().auth.signInWithPassword({ email, password });
  const [user] = await db
    .select({ id: users.id, authId: users.authId, active: users.active })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);

  // The Supabase project may hold other people's logins: only a login linked to an active user here gets in.
  if (error || !data.user || !user || !user.active || user.authId !== data.user.id) {
    await db.insert(loginAttempts).values(keys.map((key) => ({ key })));
    return { ok: false, error: "Wrong email or password." };
  }

  await db.delete(loginAttempts).where(eq(loginAttempts.key, keys[0]!));
  await createSession(user.id);
  return { ok: true };
}

export async function verifyPassword(userId: number, password: string): Promise<boolean> {
  const [u] = await db.select({ email: users.email, authId: users.authId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.authId) return false;
  const { data, error } = await supabaseAnon().auth.signInWithPassword({ email: u.email, password });
  return !error && data.user?.id === u.authId;
}
