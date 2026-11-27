import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __pg?: Pool };

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

/**
 * Supabase's transaction pooler (port 6543) is used in production. node-postgres sends one query at a time
 * and uses no prepared statements, which is what that pooler handles reliably.
 * `sslmode` is removed from the URL because pg would then verify the certificate against public CAs, which
 * Supabase's pooler does not use; the connection is still encrypted.
 */
function makePool() {
  const u = new URL(url!);
  u.searchParams.delete("sslmode");
  return new Pool({
    connectionString: u.toString(),
    ssl: { rejectUnauthorized: false },
    // Serverless functions each hold their own pool, so keep it small in production.
    max: process.env.NODE_ENV === "production" ? 2 : 10,
    connectionTimeoutMillis: 10_000, // fail fast instead of waiting for Vercel's 300 s kill
    idleTimeoutMillis: 5_000,
    maxLifetimeSeconds: 300,
    keepAlive: true,
  });
}

const pool = globalForDb.__pg ?? makePool();
if (process.env.NODE_ENV !== "production") globalForDb.__pg = pool;
// On Vercel, keeps the instance alive until idle connections are released, so a frozen instance
// does not leave half-open connections behind in the pooler.
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
export { schema };
