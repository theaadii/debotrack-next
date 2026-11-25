import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { buildLeadsExport, fileResponse } from "@/server/exporter";

const int = (v: string | null) => (v && Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : undefined);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!session.can("leads.export")) return NextResponse.json({ error: "You don't have permission to export enquiries." }, { status: 403 });

  const p = req.nextUrl.searchParams;
  const built = await buildLeadsExport(session, {
    q: p.get("q") ?? undefined, stageId: int(p.get("stage")), sourceId: int(p.get("source")), ownerId: int(p.get("owner")), programId: int(p.get("program")),
    from: p.get("from") || undefined, to: p.get("to") || undefined,
  });
  return fileResponse(built, p.get("format") === "csv" ? "csv" : "xlsx", "enquiries");
}
