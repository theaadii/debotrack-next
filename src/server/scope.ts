import "server-only";
import { eq, type SQL } from "drizzle-orm";
import type { Session } from "@/lib/auth";
import { leads, learners } from "@/db/schema";

/** Roles with "own" scope only see the enquiries / learners assigned to them. */
export function leadScope(session: Session): SQL | undefined {
  return session.user.viewScope === "own" ? eq(leads.ownerId, session.user.id) : undefined;
}

export function learnerScope(session: Session): SQL | undefined {
  return session.user.viewScope === "own" ? eq(learners.ownerId, session.user.id) : undefined;
}

export const TZ = "Asia/Kolkata";
