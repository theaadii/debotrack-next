import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { ActionForm, TextField } from "@/components/forms";
import { Flash } from "@/components/flash";
import { changePasswordAction } from "./actions";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireSession();
  return (
    <>
      <Suspense><Flash /></Suspense>
      <PageHeader title="Account" subtitle={`${session.user.name} · ${session.user.email} · ${session.user.roleName}`} crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Account" }]} />
      <Card className="max-w-xl">
        <CardTitle className="mb-3">Change password</CardTitle>
        <ActionForm action={changePasswordAction} submitLabel="Change password">
          <TextField name="current" label="Current password" type="password" required autoComplete="current-password" />
          <TextField name="password" label="New password" type="password" required autoComplete="new-password" hint="At least 10 characters, with upper-case, lower-case and a number." />
          <TextField name="confirm" label="Repeat the new password" type="password" required autoComplete="new-password" />
        </ActionForm>
        <p className="mt-3 text-xs text-muted-foreground">Changing your password signs you out on your other devices.</p>
      </Card>
    </>
  );
}
