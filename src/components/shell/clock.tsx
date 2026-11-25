"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function subscribeToMinutes(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

/** Date and time on the footer bar, from the viewer's own device. Updates at the start of each minute. */
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const n = new Date();
      setNow(n);
      timer = setTimeout(tick, 60_000 - (n.getSeconds() * 1000 + n.getMilliseconds()) + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  if (!now) return <span className="w-24" aria-hidden />;
  return (
    <span className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[13px] font-semibold tabular-nums" aria-label="Current time">
      <span className="hidden font-medium text-muted-foreground md:inline">
        {now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
      </span>
      <span>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
    </span>
  );
}

/** "Good morning — <message>", with the greeting based on the viewer's own time of day. */
export function Greeting({ message }: { message: string }) {
  // The hour comes from the viewer's own device; the server renders a neutral "Hello" first.
  const hour = useSyncExternalStore(subscribeToMinutes, () => new Date().getHours(), () => -1);
  const hello = hour < 0 ? "Hello" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <p className="min-w-0 truncate px-2 text-center text-[13px]">
      <strong>{hello}</strong>, {message}
    </p>
  );
}
