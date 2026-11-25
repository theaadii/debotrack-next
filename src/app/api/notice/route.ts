import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getNotice } from "@/server/notice";

/** Polled by every open page. Also tells the popup which downloads this person may use. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const notice = await getNotice();
  const downloads: { label: string; href: string }[] = [];
  if (notice.active) {
    if (session.can("leads.export")) downloads.push({ label: "Enquiries (Excel)", href: "/api/export/leads?format=xlsx" });
    if (session.can("learners.view")) downloads.push({ label: "Learners (Excel)", href: "/api/export/learners?format=xlsx" });
    if (session.can("connections.view")) downloads.push({ label: "Connections", href: "/api/export/connections" });
  }
  return NextResponse.json({ ...notice, downloads }, { headers: { "Cache-Control": "no-store" } });
}
