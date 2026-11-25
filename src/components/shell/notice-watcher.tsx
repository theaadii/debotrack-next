"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

type Notice = {
  active: boolean;
  at: string | null;
  minutesLeft: number | null;
  message: string;
  downloads: { label: string; href: string }[];
};

/**
 * Asks the server every 45 seconds whether it is about to be switched off. If so, shows a popup with
 * download buttons so counsellors can save a read-only copy of their data first.
 */
export function NoticeWatcher() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const res = await fetch("/api/notice", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const data: Notice = await res.json();
        if (!stop) setNotice(data.active ? data : null);
      } catch {
        /* offline or server restarting: try again next time */
      }
    };
    const first = setTimeout(check, 3000);
    const every = setInterval(check, 45_000);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  if (!notice || !notice.active || dismissedFor === notice.at) return null;

  const left = (notice.minutesLeft ?? 0) > 0 ? `in about ${notice.minutesLeft} minute${notice.minutesLeft === 1 ? "" : "s"}` : "very soon";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="notice-title">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
        <h2 id="notice-title" className="mb-2 text-lg font-bold">
          Server going offline {left}
        </h2>
        <p className="mb-3 text-sm leading-relaxed">
          deboTrack is about to be switched off. Download a copy of your data now so you can keep working from it. It is a{" "}
          <strong>read-only copy</strong>: nothing you change in it is saved, and the live CRM is back when the server is.
        </p>
        {notice.message && <p className="mb-3 text-sm italic">{notice.message}</p>}
        <div className="flex flex-wrap gap-2">
          {notice.downloads.length === 0 && <p className="text-sm text-muted-foreground">You have no data to download.</p>}
          {notice.downloads.map((d) => (
            <ButtonLink key={d.href} href={d.href} prefetch={false} download>
              Download {d.label}
            </ButtonLink>
          ))}
        </div>
        <div className="mt-4 text-right">
          <Button variant="secondary" onClick={() => setDismissedFor(notice.at)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
