import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { buildTemplate, fileResponse } from "@/server/exporter";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("for");
  const k = kind === "learners" ? "learners" : kind === "connections" ? "connections" : "leads";
  const need = k === "connections" ? "connections.manage" : "leads.import";
  if (!session.can(need)) return NextResponse.json({ error: "You don't have permission to import." }, { status: 403 });
  return fileResponse(buildTemplate(k), req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv", `${k}-template`);
}
