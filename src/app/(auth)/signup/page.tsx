import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MailQuestion } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { AdminAccessNotice } from "@/components/legal/admin-access-notice";
import { strParam } from "@/lib/format";
import { TOS_VERSION } from "@/lib/legal";
import { getCurrentUser } from "@/server/auth/current-user";
import { issueFormToken, turnstileSiteKey } from "@/server/bot-check";
import { findUsableInvite, requireSetUp } from "@/server/services/server";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const settings = await requireSetUp();
  if (await getCurrentUser()) redirect("/dashboard");
  const inviteToken = strParam((await searchParams).invite);
  const invite = inviteToken ? await findUsableInvite(inviteToken) : null;

  if (!invite && (inviteToken || settings.joinMode === "invite")) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <MailQuestion className="mx-auto mb-4 size-10 text-accent" />
        <h1 className="text-xl font-semibold">{inviteToken ? "This invite link isn't valid" : `${settings.name} is invite-only`}</h1>
        <p className="mt-2 text-sm text-muted">
          {inviteToken
            ? "It may have expired, been used up or been revoked. Ask the admin for a new link."
            : "Ask the server's admin to send you an invite link."}
        </p>
        <p className="mt-6 text-sm text-muted">
          Already a member? <Link className="link" href="/login">Sign in</Link>
        </p>
      </div>
    );
  }

  const siteKey = turnstileSiteKey();
  const nonce = siteKey ? ((await headers()).get("x-nonce") ?? undefined) : undefined;
  const subtitle = invite
    ? <>You&apos;ve been invited to join <b className="text-foreground">{settings.name}</b>.</>
    : settings.joinMode === "approval"
      ? <>Ask to join <b className="text-foreground">{settings.name}</b>. The admin approves new members.</>
      : <>Join <b className="text-foreground">{settings.name}</b>. Already a member? <Link className="link" href="/login">Sign in</Link></>;

  return (
    <AuthShell title="Create your account" subtitle={subtitle}>
      {siteKey && <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer nonce={nonce} />}
      <SignupForm
        notice={<AdminAccessNotice />}
        tosVersion={TOS_VERSION}
        formToken={issueFormToken()}
        turnstileSiteKey={siteKey}
        invite={invite ? inviteToken : undefined}
        submitLabel={!invite && settings.joinMode === "approval" ? "Request to join" : "Create account"}
      />
    </AuthShell>
  );
}
