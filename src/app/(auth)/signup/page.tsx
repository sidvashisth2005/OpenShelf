import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { AdminAccessNotice } from "@/components/legal/admin-access-notice";
import { TOS_VERSION } from "@/lib/legal";
import { getCurrentUser } from "@/server/auth/current-user";
import { issueFormToken, turnstileSiteKey } from "@/server/bot-check";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  const siteKey = turnstileSiteKey();
  const nonce = siteKey ? ((await headers()).get("x-nonce") ?? undefined) : undefined;
  return (
    <AuthShell
      title="Create your account"
      subtitle={<>Already have one? <Link className="link" href="/login">Sign in</Link></>}
    >
      {siteKey && <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer nonce={nonce} />}
      <SignupForm
        notice={<AdminAccessNotice />}
        tosVersion={TOS_VERSION}
        formToken={issueFormToken()}
        turnstileSiteKey={siteKey}
      />
    </AuthShell>
  );
}
