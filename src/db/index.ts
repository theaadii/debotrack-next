import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

// One shared connection pool, kept across hot reloads in development.
const client = globalForDb.__pg ?? postgres(url, {
    // Supabase's transaction pooler (port 6543) does not support prepared statements.
    prepare: false,
    // Serverless functions each hold their own pool, so keep it small in production.
    max: process.env.NODE_ENV === "production" ? 2 : 10,
    // A connection to the pooler can stall (the pooler then keeps a slot busy for minutes). Fail fast
    // instead of waiting for Vercel's 300 s kill, drop idle sockets quickly, and recycle old ones.
    connect_timeout: 10,
    idle_timeout: 10,
    max_lifetime: 300,
  });
if (process.env.NODE_ENV !== "production") globalForDb.__pg = client;

export const db = drizzle(client, { schema });
export { schema };
