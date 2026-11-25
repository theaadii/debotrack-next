import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, GitBranch, ShieldCheck, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Settings" };

const ITEMS = [
  { href: "/settings/users", label: "Users", note: "Counsellors and administrators, their logins and roles.", icon: Users, permission: "settings.users" },
  { href: "/settings/roles", label: "Roles & permissions", note: "What each kind of user can see and do.", icon: ShieldCheck, permission: "settings.roles" },
  { href: "/settings/pipeline", label: "Statuses, sources & types", note: "The pipeline stages, where enquiries come from, and lead types.", icon: GitBranch, permission: "settings.pipeline" },
  { href: "/settings/notice", label: "Server shutdown notice", note: "Warn counsellors before the server PC is switched off.", icon: BellRing, permission: "notice.manage" },
] as const;

export default async function SettingsPage() {
  const session = await requireSession();
  const items = ITEMS.filter((i) => session.can(i.permission));
  if (items.length === 0) redirect("/forbidden");
  return (
    <>
      <PageHeader title="Settings" crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="group">
            <Card className="h-full transition-colors group-hover:border-brand">
              <i.icon size={20} className="mb-2 text-brand" aria-hidden />
              <CardTitle>{i.label}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{i.note}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
