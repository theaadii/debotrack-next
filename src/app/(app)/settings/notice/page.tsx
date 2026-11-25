import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { getNotice } from "@/server/notice";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page";
import { Flash } from "@/components/flash";
import { formatDateTime } from "@/lib/utils";
import { announceNoticeAction, clearNoticeAction } from "../actions";

export const metadata: Metadata = { title: "Shutdown notice" };

export default async function NoticePage() {
  await requirePermission("notice.manage");
  const notice = await getNotice();
  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader title="Server shutdown notice" crumbs={[{ label: "Settings", href: "/settings" }, { label: "Shutdown notice" }]} />
      <Card className="max-w-xl">
        <p className="mb-4 text-sm text-muted-foreground">
          Before you switch the server PC off, send a notice. Everyone with deboTrack open gets a popup (within a minute) with download buttons for a
          read-only copy of their data. Nothing they change after the server is off can be saved.
        </p>
        {notice.active ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-brand/40 bg-brand-tint px-3 py-2 text-sm">
              <strong>A notice is active.</strong> The server goes off in about {notice.minutesLeft} min ({formatDateTime(notice.at)}).
              {notice.message && <> “{notice.message}”</>}
            </p>
            <form action={clearNoticeAction}><Button type="submit" variant="secondary">Cancel the notice</Button></form>
          </div>
        ) : (
          <form action={announceNoticeAction} className="space-y-4">
            <CardTitle>Send a notice</CardTitle>
            <Field label="Server goes off in (minutes)" htmlFor="minutes"><Input id="minutes" name="minutes" type="number" min={1} max={240} defaultValue={10} className="max-w-36" required /></Field>
            <Field label="Note for counsellors (optional)" htmlFor="message"><Input id="message" name="message" maxLength={300} placeholder="e.g. Back at 9 am tomorrow" /></Field>
            <Button type="submit">Send shutdown notice</Button>
          </form>
        )}
      </Card>
    </>
  );
}
