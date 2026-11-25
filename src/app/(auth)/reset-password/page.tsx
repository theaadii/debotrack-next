import type { Metadata } from "next";
import { AuthCard } from "../auth-card";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Set a new password" subtitle="Choose a password you haven't used here.">
      <ResetForm />
    </AuthCard>
  );
}
