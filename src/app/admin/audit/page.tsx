import { AuditTable } from "@/components/admin/audit-table";
import { Pagination } from "@/components/pagination";
import { PageHeader } from "@/components/ui";
import { pageParam, strParam } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { adminListAudit } from "@/server/services/users";

export const metadata = { title: "Activity log · Admin" };

const ACTION_FILTERS = [
  ["", "All actions"],
  ["auth.", "Authentication"],
  ["auth.login_failed", "Failed sign-ins"],
  ["content.", "User content changes"],
  ["account.", "Account changes"],
  ["admin.", "Admin actions"],
  ["admin.content.view", "Admin views of non-public content"],
] as const;

export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const admin = await requirePermission("audit:read");
  const sp = await searchParams;
  const action = strParam(sp.action);
  const actorId = strParam(sp.actorId);
  const targetId = strParam(sp.targetId);
  const page = pageParam(sp.page);
  const { entries, total, pageSize } = await adminListAudit(admin, { action, actorId, targetId, page });

  return (
    <div>
      <PageHeader eyebrow="Monitoring" title="Activity log" description={`${total} recorded event${total === 1 ? "" : "s"}.`} />
      <form className="card mb-6 flex flex-wrap gap-2 p-3">
        {actorId && <input type="hidden" name="actorId" value={actorId} />}
        {targetId && <input type="hidden" name="targetId" value={targetId} />}
        <select className="input w-auto min-w-64" name="action" defaultValue={action ?? ""}>
          {ACTION_FILTERS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>
      <AuditTable rows={entries} />
      <Pagination basePath="/admin/audit" params={{ action, actorId, targetId }} page={page} hasNext={page * pageSize < total} />
    </div>
  );
}
