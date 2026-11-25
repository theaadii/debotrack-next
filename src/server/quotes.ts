import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { leads, learners, quoteItems, quotes, users } from "@/db/schema";
import type { Session } from "@/lib/auth";

/** Roles that only see their own work only see the quotes they own. */
export function quoteScope(session: Session): SQL | undefined {
  return session.user.viewScope === "own" ? eq(quotes.ownerId, session.user.id) : undefined;
}

const esc = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export const QUOTE_SORTS = ["newest", "oldest", "total_desc", "total_asc", "expiring"] as const;
export type QuoteSort = (typeof QUOTE_SORTS)[number];
export type QuoteFilters = {
  q?: string;
  page: number;
  pageSize: number;
  sort?: QuoteSort;
  kind?: "learner" | "college" | "vendor" | "other";
  validity?: "active" | "expired";
  ownerId?: number;
  from?: string;
  to?: string;
};

function quoteOrder(sort?: QuoteSort) {
  switch (sort) {
    case "oldest": return [asc(quotes.createdAt), asc(quotes.id)];
    case "total_desc": return [desc(quotes.grandTotal), desc(quotes.id)];
    case "total_asc": return [asc(quotes.grandTotal), desc(quotes.id)];
    case "expiring": return [sql`${quotes.expiredAt} asc nulls last`, desc(quotes.id)];
    default: return [desc(quotes.createdAt), desc(quotes.id)];
  }
}

export async function listQuotes(session: Session, opts: QuoteFilters) {
  const where: (SQL | undefined)[] = [quoteScope(session)];
  const q = opts.q?.trim();
  if (q) {
    const like = `%${esc(q)}%`;
    where.push(or(ilike(quotes.subject, like), ilike(learners.name, like), ilike(quotes.recipientName, like), sql`${quotes.id}::text = ${q.replace(/^Q-?0*/i, "")}`));
  }
  if (opts.kind) where.push(eq(quotes.recipientKind, opts.kind));
  if (opts.ownerId) where.push(eq(quotes.ownerId, opts.ownerId));
  if (opts.validity === "active") where.push(sql`(${quotes.expiredAt} is null or ${quotes.expiredAt} >= current_date)`);
  if (opts.validity === "expired") where.push(sql`${quotes.expiredAt} < current_date`);
  if (opts.from) where.push(sql`${quotes.createdAt} >= ${opts.from}::date`);
  if (opts.to) where.push(sql`${quotes.createdAt} < (${opts.to}::date + 1)`);
  const cond = and(...where);

  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: quotes.id,
        subject: quotes.subject,
        learnerId: quotes.learnerId,
        learner: sql<string>`coalesce(${learners.name}, ${quotes.recipientName}, '')`,
        recipientKind: quotes.recipientKind,
        owner: users.name,
        grandTotal: quotes.grandTotal,
        expiredAt: quotes.expiredAt,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .leftJoin(learners, eq(learners.id, quotes.learnerId))
      .leftJoin(users, eq(users.id, quotes.ownerId))
      .where(cond)
      .orderBy(...quoteOrder(opts.sort))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(quotes).leftJoin(learners, eq(learners.id, quotes.learnerId)).where(cond),
  ]);
  return { rows, total: count?.n ?? 0 };
}

/** One quote with everything the detail page, the edit form and the PDF need; null when it doesn't exist or isn't theirs. */
export async function getQuote(session: Session, id: number) {
  const [row] = await db
    .select({
      q: quotes,
      learner: sql<string>`coalesce(${learners.name}, ${quotes.recipientName}, '')`,
      phones: sql<string[]>`coalesce(${learners.phones}, '{}'::text[])`,
      emails: sql<string[]>`coalesce(${learners.emails}, '{}'::text[])`,
      owner: users.name,
      leadTitle: leads.title,
    })
    .from(quotes)
    .leftJoin(learners, eq(learners.id, quotes.learnerId))
    .leftJoin(users, eq(users.id, quotes.ownerId))
    .leftJoin(leads, eq(leads.id, quotes.leadId))
    .where(and(eq(quotes.id, id), quoteScope(session)))
    .limit(1);
  if (!row) return null;
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).orderBy(asc(quoteItems.position), asc(quoteItems.id));
  return { ...row.q, learner: row.learner, phones: row.phones, emails: row.emails, owner: row.owner, leadTitle: row.leadTitle, items };
}

export type QuoteDetail = NonNullable<Awaited<ReturnType<typeof getQuote>>>;

export async function quotesForLead(session: Session, leadId: number) {
  return db
    .select({ id: quotes.id, subject: quotes.subject, grandTotal: quotes.grandTotal, expiredAt: quotes.expiredAt, createdAt: quotes.createdAt })
    .from(quotes)
    .where(and(eq(quotes.leadId, leadId), quoteScope(session)))
    .orderBy(desc(quotes.createdAt));
}

/** "Q-0042": the number shown on screen and in the PDF. */
export const quoteNumber = (id: number) => `Q-${String(id).padStart(4, "0")}`;
