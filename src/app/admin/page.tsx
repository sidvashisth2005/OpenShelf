import Link from "next/link";
import { ArrowRight, HardDrive, KeyRound, Library, ShieldAlert, Upload, UserPlus, Users } from "lucide-react";
import { AuditTable } from "@/components/admin/audit-table";
import { PageHeader, StatCard } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { adminListAudit, platformStats } from "@/server/services/users";

export const metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const admin = await requirePermission("admin:dashboard");
  const [stats, recent] = await Promise.all([platformStats(admin), adminListAudit(admin, { page: 1 })]);
  if (!stats) return null;
  const totalUsers = (stats.users.active ?? 0) + (stats.users.suspended ?? 0) + (stats.users.deleted ?? 0);
  const totalContent = (stats.content.published ?? 0) + (stats.content.draft ?? 0) + (stats.content.removed ?? 0);

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Monitoring" title="Platform overview" description="Live numbers across every account and upload." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Users"
          value={totalUsers}
          hint={`${stats.users.active ?? 0} active · ${stats.users.suspended ?? 0} suspended · ${stats.users.deleted ?? 0} removed`}
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
          <StatCard icon={UserPlus} label="New users" value={stats.last24h.newUsers} />
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
          <Link className="btn btn-ghost btn-sm" href="/admin/audit">Full log <ArrowRight /></Link>
        </div>
        <AuditTable rows={recent.entries.slice(0, 12)} />
      </section>
    </div>
  );
}
