import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { serverNotice } from "@/db/schema";

export type NoticeState = { active: boolean; at: string | null; minutesLeft: number | null; message: string };
const NONE: NoticeState = { active: false, at: null, minutesLeft: null, message: "" };

/** A notice stays up for an hour after its shutdown time, then clears itself. */
export async function getNotice(): Promise<NoticeState> {
  const [row] = await db.select().from(serverNotice).where(eq(serverNotice.id, 1)).limit(1);
  if (!row) return NONE;
  if (row.at.getTime() + 3600_000 < Date.now()) {
    await db.delete(serverNotice).where(eq(serverNotice.id, 1));
    return NONE;
  }
  return {
    active: true,
    at: row.at.toISOString(),
    minutesLeft: Math.max(0, Math.ceil((row.at.getTime() - Date.now()) / 60_000)),
    message: row.message ?? "",
  };
}

export async function announceNotice(minutes: number, message: string) {
  const at = new Date(Date.now() + Math.max(0, minutes) * 60_000);
  const values = { id: 1, at, message: message.trim().slice(0, 300) || null };
  await db.insert(serverNotice).values(values).onConflictDoUpdate({ target: serverNotice.id, set: { at, message: values.message } });
}

export async function clearNotice() {
  await db.delete(serverNotice).where(eq(serverNotice.id, 1));
}
