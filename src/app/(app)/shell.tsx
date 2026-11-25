import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { NAV } from "@/components/shell/nav";
import { NavLink } from "@/components/shell/nav-link";
import { MobileMenu } from "@/components/shell/mobile-menu";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Clock, Greeting } from "@/components/shell/clock";
import { NoticeWatcher } from "@/components/shell/notice-watcher";
import { logoutAction } from "../(auth)/actions";
import { initials } from "@/lib/utils";

export async function Shell({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [footer] = await db.select().from(settings).where(eq(settings.key, "footer_message")).limit(1);

  const items = NAV.filter((i) => (i.permission ? session.can(i.permission) : i.anyOf ? i.anyOf.some((k) => session.can(k)) : true));
  const groups = (["Admissions", "Catalogue", "Administration"] as const)
    .map((g) => ({ name: g, items: items.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);
  const links = groups.map((g) => (
    <div key={g.name} role="group" aria-label={g.name} className="mb-3 flex flex-col gap-0.5">
      <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground/80">{g.name}</p>
      {g.items.map((i) => (
        <NavLink key={i.href} href={i.href} label={i.label}>
          <i.icon size={18} aria-hidden />
        </NavLink>
      ))}
    </div>
  ));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background px-3 md:px-5">
        <MobileMenu>{links}</MobileMenu>
        <Link href="/dashboard" className="shrink-0" aria-label="deboTrack home">
          <Image src="/brand/logo-light.png" alt="deboTrack" width={110} height={40} priority className="h-12 w-auto dark:hidden" />
          <Image src="/brand/logo-dark.png" alt="deboTrack" width={110} height={40} priority className="hidden h-12 w-auto dark:block" />
        </Link>

        {session.can("leads.view") && (
          <form action="/leads" role="search" className="mx-auto hidden w-full max-w-md items-center md:flex">
            <label htmlFor="global-search" className="sr-only">Search enquiries</label>
            <div className="relative w-full">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                id="global-search"
                name="q"
                placeholder="Search learners, phone, email…"
                className="h-9 w-full rounded-full border border-border bg-muted pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-tint"
              />
            </div>
          </form>
        )}

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <details className="relative">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground [&::-webkit-details-marker]:hidden"
              aria-label="Account menu"
            >
              {initials(session.user.name)}
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold">{session.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{session.user.roleName}</p>
              </div>
              <Link href="/account" className="block rounded-lg px-3 py-2 text-sm hover:bg-muted">Account &amp; password</Link>
              <form action={logoutAction}>
                <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">Sign out</button>
              </form>
            </div>
          </details>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 flex-col overflow-y-auto border-r border-border bg-background p-3 lg:flex">{links}</aside>
        <main className="mx-auto min-w-0 max-w-[1500px] flex-1 p-3 pb-[calc(var(--footer-h)+1.25rem)] md:p-5 md:pb-[calc(var(--footer-h)+1.5rem)]">{children}</main>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 flex h-[var(--footer-h)] items-center justify-between gap-2 border-t border-border bg-card px-3 md:px-4 lg:left-52">
        <span className="hidden w-24 md:block" aria-hidden />
        <Greeting message={footer?.value ?? "Ready to turn today's enquiries into admissions?"} />
        <Clock />
      </footer>

      <NoticeWatcher />
    </div>
  );
}
