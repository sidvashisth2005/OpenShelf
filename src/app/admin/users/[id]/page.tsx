import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Ban, ImageOff, PauseCircle, PlayCircle, ShieldCheck } from "lucide-react";
import { userAction } from "@/app/actions/admin";
import { AuditTable } from "@/components/admin/audit-table";
import { Badge } from "@/components/badge";
import { ContentCard, ContentGrid } from "@/components/content-card";
import { ReasonActionForm } from "@/components/reason-action-form";
import { Avatar, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { hasPermission, outranks } from "@/lib/rbac";
import { requirePermission } from "@/server/auth/current-user";
import { adminListContent } from "@/server/services/content";
import { adminGetUser, adminListAudit } from "@/server/services/users";

export const metadata = { title: "User · Admin" };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requirePermission("user:read:any");
  const { id } = await params;
  const detail = await adminGetUser(admin, id);
  if (!detail) notFound();
  const { user, tosAcceptances } = detail;
  const [{ items, total }, activity] = await Promise.all([
    adminListContent(admin, { ownerId: id, page: 1 }),
    adminListAudit(admin, { actorId: id, page: 1 }),
  ]);
  const manageable = user.id !== admin.id && outranks(admin, user) && user.status !== "deleted";

  const facts: [string, React.ReactNode][] = [
    ["Email", user.email],
    ["User ID", <span key="id" className="font-mono text-xs">{user.id}</span>],
    ["Joined", formatDate(user.createdAt)],
    ["Last sign-in", formatDate(user.lastLoginAt)],
    ["Terms accepted", user.tosVersion ? `v${user.tosVersion} on ${formatDate(user.tosAcceptedAt)}` : "—"],
  ];
  if (user.statusReason) facts.push(["Status reason", user.statusReason]);

  return (
    <div className="space-y-10">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={user.displayName} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{user.displayName}</h1>
              <p className="text-sm text-muted">@{user.username}</p>
            </div>
            <div className="ml-auto flex gap-1.5">
              <Badge value={user.status} />
              {user.role !== "user" && <Badge value={user.role} />}
            </div>
          </div>
          <dl className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[140px_1fr]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="break-words">{v}</dd>
              </div>
            ))}
          </dl>
          {tosAcceptances.length > 1 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted hover:text-foreground">Consent history ({tosAcceptances.length})</summary>
              <ul className="mt-2 space-y-1">
                {tosAcceptances.map((t) => (
                  <li key={t.id}>v{t.version}: {formatDate(t.acceptedAt)} from {t.ip ?? "unknown IP"}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="card space-y-4 p-6">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-accent" /> Account actions</h2>
          {!manageable && <p className="text-sm text-muted">No actions available for this account.</p>}
          {manageable && hasPermission(admin, "user:suspend") && (
            user.status === "suspended" ? (
              <ReasonActionForm action={userAction.bind(null, user.id, "unsuspend")} label="Unsuspend" icon={<PlayCircle />} block successText="Account reactivated." />
            ) : (
              <ReasonActionForm action={userAction.bind(null, user.id, "suspend")} label="Suspend" icon={<PauseCircle />} requireReason block successText="Suspended and signed out everywhere." />
            )
          )}
          {manageable && hasPermission(admin, "user:remove") && (
            <details className="text-sm">
              <summary className="cursor-pointer text-danger">Remove account…</summary>
              <p className="my-2 text-muted">Closes the account, signs it out, and takes all of its content out of public view.</p>
              <ReasonActionForm
                action={userAction.bind(null, user.id, "remove")}
                label="Remove account"
                icon={<Ban />}
                requireReason
                variant="danger"
                block
                confirmText={`Remove @${user.username}? Their content will be taken down.`}
                successText="Account removed."
              />
            </details>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Content <span className="font-normal text-muted">({total})</span></h2>
          {total > items.length && (
            <Link className="btn btn-ghost btn-sm" href={`/admin/content?ownerId=${user.id}`}>See all <ArrowRight /></Link>
          )}
        </div>
        {items.length === 0 ? (
          <EmptyState icon={ImageOff} title="No content" />
        ) : (
          <ContentGrid>
            {items.map((item) => <ContentCard key={item.id} item={item} showStatus />)}
          </ContentGrid>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Activity by this user</h2>
          <Link className="btn btn-ghost btn-sm" href={`/admin/audit?targetId=${user.id}`}>Actions on this account <ArrowRight /></Link>
        </div>
        <AuditTable rows={activity.entries.slice(0, 20)} />
      </section>
    </div>
  );
}
