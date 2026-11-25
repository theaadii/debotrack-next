import { BookUser, CalendarCheck, FileText, FolderKanban, GraduationCap, LayoutDashboard, Settings, Users, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; group: "Admissions" | "Catalogue" | "Administration"; permission?: string; anyOf?: string[] };

/** Sidebar order = importance: the dashboard, then the daily work, then reference data, then settings. */
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Admissions" },
  { label: "Enquiries", group: "Admissions", href: "/leads", icon: Users, permission: "leads.view" },
  { label: "Learners", group: "Admissions", href: "/learners", icon: GraduationCap, permission: "learners.view" },
  { label: "Quotes", group: "Admissions", href: "/quotes", icon: FileText, permission: "quotes.view" },
  { label: "Activities", group: "Admissions", href: "/activities", icon: CalendarCheck, permission: "leads.view" },
  { label: "Programs", group: "Catalogue", href: "/programs", icon: FolderKanban, permission: "programs.view" },
  { label: "Connections", group: "Catalogue", href: "/connections", icon: BookUser, permission: "connections.view" },
  { label: "Settings", group: "Administration", href: "/settings", icon: Settings, anyOf: ["settings.users", "settings.roles", "settings.pipeline", "notice.manage"] },
];
