import Link from "next/link";
import { KeyRound, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Avatar, PageHeader } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { listOwn } from "@/server/services/content";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "./settings-forms";

export const metadata = { title: "Settings" };

function Section({
  icon: Icon,
  title,
  description,
  danger,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`card grid gap-6 p-6 md:grid-cols-[220px_1fr] ${danger ? "border-danger/30" : ""}`}>
      <div>
        <h2 className={`flex items-center gap-2 font-semibold ${danger ? "text-danger" : ""}`}>
          <Icon className="size-4" /> {title}
        </h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser({ next: "/settings" });

  if (user.role === "super_admin") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Account" title="Settings" />
        <Section icon={ShieldCheck} title="Super admin" description="This account is defined by server configuration.">
          <p className="text-sm leading-6 text-muted">
            The super admin is configured by <code className="rounded bg-surface-2 px-1">SUPER_ADMIN_EMAIL</code> and{" "}
            <code className="rounded bg-surface-2 px-1">SUPER_ADMIN_PASSWORD_HASH_B64</code>. To change its password,
            generate a new hash with <code className="rounded bg-surface-2 px-1">npm run admin:hash</code>, update the
            environment, and restart the server.
          </p>
        </Section>
      </div>
    );
  }

  const content = await listOwn(user);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Account" title="Settings" description="Manage your profile, password and account." />

      <div className="card flex flex-wrap items-center gap-4 p-6">
        <Avatar name={user.displayName} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{user.displayName}</p>
          <p className="text-sm text-muted">@{user.username} · {user.email}</p>
        </div>
        <p className="text-xs text-muted">
          Accepted <Link className="link" href="/terms">Terms</Link> &amp; <Link className="link" href="/privacy">Privacy</Link>{" "}
          v{user.tosVersion}
        </p>
      </div>

      <Section icon={UserRound} title="Profile" description="How you appear to others.">
        <ProfileForm displayName={user.displayName} />
      </Section>

      <Section icon={KeyRound} title="Password" description="Changing it signs you out on every other device.">
        <PasswordForm />
      </Section>

      <Section icon={Trash2} title="Delete account" description="Permanently remove your account and uploads." danger>
        <DeleteAccountForm contentCount={content.length} />
      </Section>

    </div>
  );
}
