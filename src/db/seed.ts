/**
 * Creates the starting data: roles, the first administrator, pipeline stages, lead sources and types.
 * Safe to run again — it only fills in what is missing.   Run:  pnpm db:seed
 * Reads .env.local / .env when present, so it also works with DATABASE_URL exported in the shell.
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { count, isNull, sql } from "drizzle-orm";
import * as s from "./schema";

// Same lookup as drizzle.config.ts. dotenv ignores missing files.
config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema: s });

const COUNSELLOR_PERMISSIONS = [
  "leads.view", "leads.create", "leads.edit", "leads.import", "leads.export",
  "learners.view", "learners.manage", "programs.view", "connections.view", "activities.manage",
  "quotes.view", "quotes.create", "quotes.edit",
];

async function main() {
  await db.insert(s.roles).values([
    { name: "Administrator", description: "Full access", permissionType: "all", permissions: [], viewScope: "all" },
    { name: "Counsellor", description: "Works the enquiries assigned to them", permissionType: "custom", permissions: COUNSELLOR_PERMISSIONS, viewScope: "own" },
  ]).onConflictDoNothing();

  const [{ n: stageCount } = { n: 0 }] = await db.select({ n: count() }).from(s.pipelineStages);
  if (stageCount === 0) {
    await db.insert(s.pipelineStages).values([
      { name: "New", kind: "open", sortOrder: 1, probability: 10 },
      { name: "Follow Up", kind: "open", sortOrder: 2, probability: 25 },
      { name: "Prospect", kind: "open", sortOrder: 3, probability: 40 },
      { name: "Negotiation", kind: "open", sortOrder: 4, probability: 70 },
      { name: "Won", kind: "won", sortOrder: 5, probability: 100 },
      { name: "Lost", kind: "lost", sortOrder: 6, probability: 0 },
    ]);
  }

  await db.insert(s.leadSources).values(
    ["Email", "Web", "Web Form", "Phone", "Direct", "Walk-in", "Referral", "College visit"].map((name) => ({ name })),
  ).onConflictDoNothing();
  await db.insert(s.leadTypes).values([{ name: "New Business" }, { name: "Existing Business" }]).onConflictDoNothing();

  await db.insert(s.settings).values({ key: "footer_message", value: "Ready to turn today's enquiries into admissions?" }).onConflictDoNothing();

  const [{ n: userCount } = { n: 0 }] = await db.select({ n: count() }).from(s.users);
  if (userCount === 0) {
    const [admin] = await db.select().from(s.roles).where(sql`${s.roles.name} = 'Administrator'`);
    await db.insert(s.users).values({ name: "Administrator", email: process.env.SEED_ADMIN_EMAIL || "admin@example.com", roleId: admin!.id });
  }

  // Passwords live in Supabase Auth: give every user that has no login yet one (also links admins created before the move).
  const unlinked = await db.select().from(s.users).where(isNull(s.users.authId));
  if (unlinked.length) {
    const sbUrl = process.env.SUPABASE_URL, sbKey = process.env.SUPABASE_SECRET_KEY;
    if (!sbUrl || !sbKey) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set to create logins.");
    const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const u of unlinked) {
      const generated = !process.env.SEED_ADMIN_PASSWORD;
      const password = process.env.SEED_ADMIN_PASSWORD || `Dt-${randomBytes(9).toString("base64url")}!9`;
      const { data, error } = await sb.auth.admin.createUser({ email: u.email, password, email_confirm: true });
      if (error || !data.user) throw new Error(`Could not create the login for ${u.email}: ${error?.message} (if it says the email exists, the Supabase project already has that email — use another SEED_ADMIN_EMAIL).`);
      await db.update(s.users).set({ authId: data.user.id }).where(sql`${s.users.id} = ${u.id}`);
      console.log(`
Login created:
  email:    ${u.email}
  password: ${generated ? password : "(the one you set in SEED_ADMIN_PASSWORD)"}
  Change it after signing in.
`);
    }
  } else {
    console.log("Every user already has a login.");
  }
  console.log("Seed finished.");
}

main().then(() => client.end()).catch(async (e) => { console.error(e); await client.end(); process.exit(1); });
