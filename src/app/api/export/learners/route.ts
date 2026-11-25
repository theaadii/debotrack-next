import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { buildLearnersExport, fileResponse } from "@/server/exporter";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!session.can("learners.view")) return NextResponse.json({ error: "You don't have permission to export learners." }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const built = await buildLearnersExport(session, { q: p.get("q") ?? undefined });
  return fileResponse(built, p.get("format") === "csv" ? "csv" : "xlsx", "learners");
}
