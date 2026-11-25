import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Auth is only the credential store (passwords, reset e-mails). Roles, permissions and the
 * browser session stay in this app — see lib/auth.ts. Both clients are server-only and keep no session.
 */
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set.`);
  return v;
}

let anon: SupabaseClient | undefined;
let admin: SupabaseClient | undefined;

/** Public client: sign-in checks and reset e-mails. */
export const supabaseAnon = () => (anon ??= createClient(need("SUPABASE_URL"), need("SUPABASE_PUBLISHABLE_KEY"), opts));

/** Secret-key client: creates, updates and deletes logins. Never expose this key to the browser. */
export const supabaseAdmin = () => (admin ??= createClient(need("SUPABASE_URL"), need("SUPABASE_SECRET_KEY"), opts));

type R = { ok: true; id: string } | { ok: false; error: string };

export async function createLogin(email: string, password: string): Promise<R> {
  const { data, error } = await supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) {
    // The Supabase project may be shared with another app whose users already own this address.
    const taken = error?.code === "email_exists" || /already|registered/i.test(error?.message ?? "");
    return { ok: false, error: taken ? "This email is already registered in Supabase (maybe by another app). Use a different email." : (error?.message ?? "Could not create the login.") };
  }
  return { ok: true, id: data.user.id };
}

export async function updateLogin(authId: string, patch: { email?: string; password?: string }): Promise<string | null> {
  const { error } = await supabaseAdmin().auth.admin.updateUserById(authId, { ...patch, ...(patch.email ? { email_confirm: true } : {}) });
  return error ? (error.code === "email_exists" ? "This email is already registered in Supabase (maybe by another app). Use a different email." : error.message) : null;
}

export async function deleteLogin(authId: string) {
  await supabaseAdmin().auth.admin.deleteUser(authId);
}
