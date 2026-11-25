import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, learners } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { splitList } from "@/lib/phone";
import { emailProblem, phoneProblem } from "@/lib/validate";
import { findExistingLearner } from "@/server/learner-service";
import { learnerScope } from "@/server/scope";

/** "Is this phone / email already saved?" — used by the create forms to warn before saving. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  if (!session.can("learners.view") && !session.can("leads.view") && !session.can("leads.create")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const url = new URL(req.url);
  const phones = splitList(url.searchParams.get("phone") ?? "").slice(0, 5).filter((p) => !phoneProblem(p));
  const emails = splitList(url.searchParams.get("email") ?? "").slice(0, 5).filter((e) => !emailProblem(e));
  const except = Number(url.searchParams.get("except"));

  const id = await findExistingLearner(phones, emails, learnerScope(session), Number.isInteger(except) && except > 0 ? except : undefined);
  if (!id) return NextResponse.json({ match: null });

  const [row] = await db.select({ id: learners.id, name: learners.name, phones: learners.phones }).from(learners).where(eq(learners.id, id)).limit(1);
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(eq(leads.learnerId, id));
  return NextResponse.json({ match: row ? { id: row.id, name: row.name, phones: row.phones, enquiries: count?.n ?? 0 } : null });
}
