import Link from "next/link";
import { UserCheck } from "lucide-react";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { getServerSettings } from "@/server/services/server";
import { adminListUsers } from "@/server/services/users";
import { DecideButtons } from "./decide-buttons";

export const metadata = { title: "Join requests · Admin" };

export default async function JoinRequestsPage() {
  const admin = await requirePermission("user:approve");
  const [{ users }, settings] = await Promise.all([adminListUsers(admin, { status: "pending", page: 1 }), getServerSettings()]);

  return (
    <div>
      <PageHeader
        eyebrow="Members"
        title="Join requests"
        description="People who asked to join. Approve them to let them sign in."
      />
      {settings?.joinMode !== "approval" && (
        <p className="mb-4 text-sm text-muted">
          Your server is set to <b>{settings?.joinMode === "open" ? "Open" : "Invite only"}</b>, so new requests only
          arrive here when you choose <b>Ask to join</b> in <Link className="link" href="/admin/settings">Server settings</Link>.
        </p>
      )}
      {users.length === 0 ? (
        <EmptyState icon={UserCheck} title="No pending requests" description="You're all caught up." />
      ) : (
        <div className="card divide-y divide-border">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-4 p-4">
              <Avatar name={u.displayName} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.displayName} <span className="font-normal text-muted">@{u.username}</span></p>
                <p className="truncate text-xs text-muted">{u.email} · asked {formatDate(u.createdAt)}</p>
              </div>
              <DecideButtons id={u.id} name={u.displayName} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
