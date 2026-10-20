import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AdminAccessNotice } from "@/components/legal/admin-access-notice";
import { TOS_VERSION } from "@/lib/legal";
import { getCurrentUser } from "@/server/auth/current-user";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <AuthShell
      title="Create your account"
      subtitle={<>Already have one? <Link className="link" href="/login">Sign in</Link></>}
    >
      <SignupForm notice={<AdminAccessNotice />} tosVersion={TOS_VERSION} />
    </AuthShell>
  );
}
