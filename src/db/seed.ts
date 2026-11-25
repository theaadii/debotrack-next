/**
 * Creates the starting data: roles, the first administrator, pipeline stages, lead sources and types.
 * Safe to run again — it only fills in what is missing.   Run:  pnpm db:seed
 * Reads .env.local / .env when present, so it also works with DATABASE_URL exported in the shell.
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { count, sql } from "drizzle-orm";
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
    const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
    const generated = !process.env.SEED_ADMIN_PASSWORD;
    const password = process.env.SEED_ADMIN_PASSWORD || `Dt-${randomBytes(9).toString("base64url")}!9`;
    await db.insert(s.users).values({ name: "Administrator", email, passwordHash: await bcrypt.hash(password, 12), roleId: admin!.id });
    console.log(`\nAdministrator created:\n  email:    ${email}\n  password: ${generated ? password : "(the one you set in SEED_ADMIN_PASSWORD)"}\n  Change it after signing in.\n`);
  } else {
    console.log("Users already exist — no administrator created.");
  }
  console.log("Seed finished.");
}

main().then(() => client.end()).catch(async (e) => { console.error(e); await client.end(); process.exit(1); });
