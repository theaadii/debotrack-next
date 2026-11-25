import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { buildConnectionsExport, fileResponse } from "@/server/exporter";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!session.can("connections.view")) return NextResponse.json({ error: "You don't have permission to export connections." }, { status: 403 });
  return fileResponse(await buildConnectionsExport(), req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv", "connections");
}
