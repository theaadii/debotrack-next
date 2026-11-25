import { NextResponse } from "next/server";
import { and, asc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { learners } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { learnerScope } from "@/server/scope";

const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/** Type-ahead for "which learner?" pickers: a handful of matches by name, phone or email. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  if (!session.can("learners.view") && !session.can("leads.view") && !session.can("quotes.create")) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const like = `%${esc(q)}%`;
  const digits = q.replace(/\D/g, "");
  const rows = await db
    .select({ id: learners.id, name: learners.name, phones: learners.phones, emails: learners.emails, city: learners.city })
    .from(learners)
    .where(
      and(
        learnerScope(session),
        or(ilike(learners.name, like), sql`array_to_string(${learners.emailKeys}, ',') ilike ${like}`, digits.length >= 3 ? sql`exists (select 1 from unnest(${learners.phoneKeys}) k where k like ${"%" + digits + "%"})` : undefined),
      ),
    )
    .orderBy(asc(learners.name))
    .limit(8);
  return NextResponse.json({ results: rows.map((r) => ({ id: r.id, name: r.name, phone: r.phones[0] ?? "", email: r.emails[0] ?? "", city: r.city ?? "" })) });
}
