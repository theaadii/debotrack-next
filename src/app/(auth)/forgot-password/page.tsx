import type { Metadata } from "next";
import { AuthCard } from "../auth-card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot password" subtitle="Enter your email and we'll send you a link to set a new password.">
      <ForgotForm />
    </AuthCard>
  );
}
