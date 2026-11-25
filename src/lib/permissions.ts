/** Every permission a role can hold. The administrator role holds all of them. */
export const PERMISSION_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "Enquiries",
    items: [
      { key: "leads.view", label: "View enquiries" },
      { key: "leads.create", label: "Create enquiries" },
      { key: "leads.edit", label: "Edit enquiries and change status" },
      { key: "leads.delete", label: "Delete enquiries" },
      { key: "leads.import", label: "Import enquiries / learners" },
      { key: "leads.export", label: "Export enquiries" },
    ],
  },
  {
    group: "Learners & colleges",
    items: [
      { key: "learners.view", label: "View learners and colleges" },
      { key: "learners.manage", label: "Add, edit and delete learners and colleges" },
    ],
  },
  {
    group: "Quotes",
    items: [
      { key: "quotes.view", label: "View quotes and download their PDF" },
      { key: "quotes.create", label: "Create quotes" },
      { key: "quotes.edit", label: "Edit quotes" },
      { key: "quotes.delete", label: "Delete quotes" },
    ],
  },
  {
    group: "Programs",
    items: [
      { key: "programs.view", label: "View programs and batches" },
      { key: "programs.manage", label: "Add, edit and delete programs and batches" },
    ],
  },
  {
    group: "Connections",
    items: [
      { key: "connections.view", label: "View connections (HOD, Principal, TPO…)" },
      { key: "connections.manage", label: "Add, edit, delete, import and export connections" },
    ],
  },
  {
    group: "Activities",
    items: [{ key: "activities.manage", label: "Log notes, calls, meetings and tasks" }],
  },
  {
    group: "Administration",
    items: [
      { key: "settings.users", label: "Manage users" },
      { key: "settings.roles", label: "Manage roles" },
      { key: "settings.pipeline", label: "Manage pipeline stages, sources and lead types" },
      { key: "notice.manage", label: "Send server shutdown notices" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export type AccessInfo = {
  permissionType: "all" | "custom";
  permissions: string[];
};

export function hasPermission(access: AccessInfo, key: string): boolean {
  return access.permissionType === "all" || access.permissions.includes(key);
}
