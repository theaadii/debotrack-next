import { getSession } from "@/lib/auth";
import { parseId } from "@/lib/utils";
import { renderQuotePdf } from "@/server/quote-pdf";
import { getQuote, quoteNumber } from "@/server/quotes";

/** The quote as a PDF, opened in the browser (or saved from there). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in again." }, { status: 401 });
  if (!session.can("quotes.view")) return Response.json({ error: "Not allowed." }, { status: 403 });

  const id = parseId((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Not found." }, { status: 404 });
  const quote = await getQuote(session, id);
  if (!quote) return Response.json({ error: "Not found." }, { status: 404 });

  const pdf = await renderQuotePdf(quote);
  const safe = quote.subject.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "quote";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quoteNumber(quote.id)}-${safe.replace(/[^\x20-\x7e]/g, "")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
