import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  HardDrive,
  KeyRound,
  Library,
  ShieldAlert,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { AuditTable } from "@/components/admin/audit-table";
import { PageHeader, StatCard } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { getServerSettings, listInvites, pendingCount } from "@/server/services/server";
import { adminListAudit, platformStats } from "@/server/services/users";

export const metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const admin = await requirePermission("admin:dashboard");
  const [stats, recent, settings, invites, pending] = await Promise.all([
    platformStats(admin),
    adminListAudit(admin, { page: 1 }),
    getServerSettings(),
    listInvites(admin),
    pendingCount(),
  ]);
  if (!stats) return null;
  const members = (stats.users.active ?? 0) + (stats.users.suspended ?? 0);
  const totalContent = (stats.content.published ?? 0) + (stats.content.draft ?? 0) + (stats.content.removed ?? 0);
  const steps = [
    {
      done: Boolean(settings?.lanEnabled),
      title: "Share it on your Wi-Fi",
      body: "So phones and computers on your network can open your server.",
      href: "/admin/settings",
      cta: "Open settings",
    },
    {
      done: invites.length > 0,
      title: "Create an invite link",
      body: "Choose how many people can use it and when it expires.",
      href: "/admin/invites",
      cta: "Create link",
    },
    {
      done: members > 0,
      title: "Send the link to people",
      body: "They open it, create their account, and they are in.",
      href: "/admin/invites",
      cta: "Invite links",
    },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={admin.role === "super_admin" ? "Super Admin" : "Your server"}
        title={settings?.name ?? "Overview"}
        description="Members, uploads and activity on this server."
      />

      {steps.some((s) => !s.done) && <GetStarted steps={steps} />}

      {pending > 0 && (
        <Link href="/admin/requests" className="card flex items-center gap-4 border-accent/40 p-4 transition hover:shadow-lift">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <UserCheck className="size-5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">
              {pending} {pending === 1 ? "person wants" : "people want"} to join
            </span>
            <span className="block text-sm text-muted">Review and approve their requests.</span>
          </span>
          <ArrowRight className="size-4 text-muted" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Members"
          value={members}
          hint={`${stats.users.active ?? 0} active · ${stats.users.suspended ?? 0} suspended · ${pending} waiting`}
          href="/admin/users"
        />
        <StatCard
          icon={Library}
          label="Content items"
          value={totalContent}
          hint={`${stats.content.published ?? 0} published · ${stats.content.draft ?? 0} draft · ${stats.content.removed ?? 0} removed`}
          href="/admin/content"
          tone="info"
        />
        <StatCard icon={HardDrive} label="Storage used" value={formatBytes(stats.storageBytes)} tone="success" />
        <StatCard icon={KeyRound} label="Active sessions" value={stats.activeSessions} tone="warn" />
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">Last 24 hours</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={UserPlus} label="New members" value={stats.last24h.newUsers} />
          <StatCard icon={Upload} label="New uploads" value={stats.last24h.newContent} tone="info" />
          <StatCard
            icon={ShieldAlert}
            label="Failed sign-ins"
            value={stats.last24h.failedLogins}
            href="/admin/audit?action=auth.login_failed"
            tone={stats.last24h.failedLogins > 10 ? "danger" : "warn"}
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <Link className="btn btn-ghost btn-sm" href="/admin/audit">
            Full log <ArrowRight />
          </Link>
        </div>
        <AuditTable rows={recent.entries.slice(0, 12)} />
      </section>
    </div>
  );
}

function GetStarted({ steps }: { steps: { done: boolean; title: string; body: string; href: string; cta: string }[] }) {
  return (
    <section className="card p-6">
      <h2 className="font-semibold">Get your server ready</h2>
      <p className="mt-1 text-sm text-muted">Three quick steps to bring people in.</p>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className={`rounded-xl border p-4 ${s.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {s.done ? (
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="size-4 text-muted" />
              )}
              {i + 1}. {s.title}
            </div>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
            {!s.done && (
              <Link className="btn btn-secondary btn-sm mt-3" href={s.href}>
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
