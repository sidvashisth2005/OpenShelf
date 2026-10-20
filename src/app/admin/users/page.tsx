import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/badge";
import { Pagination } from "@/components/pagination";
import { Avatar, EmptyState, PageHeader } from "@/components/ui";
import { formatBytes, formatDate, pageParam, strParam } from "@/lib/format";
import { requirePermission } from "@/server/auth/current-user";
import { PAGE_SIZE } from "@/server/services/content";
import { adminListUsers } from "@/server/services/users";

export const metadata = { title: "Users · Admin" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requirePermission("user:read:any");
  const sp = await searchParams;
  const q = strParam(sp.q);
  const status = strParam(sp.status);
  const page = pageParam(sp.page);
  const { users, total } = await adminListUsers(admin, { q, status, page });

  return (
    <div>
      <PageHeader eyebrow="Accounts" title="Users" description={`${total} account${total === 1 ? "" : "s"} on the platform.`} />
      <form className="card mb-6 flex flex-wrap gap-2 p-3" role="search">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" name="q" placeholder="Search email, username or name" defaultValue={q} />
        </div>
        <select className="input w-auto" name="status" defaultValue={status ?? ""}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Removed</option>
        </select>
        <button className="btn btn-secondary" type="submit">Filter</button>
      </form>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No users match" description="Try a different search or status filter." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th className="text-right">Content</th>
                  <th>Joined</th>
                  <th>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="min-w-64">
                      <Link className="group flex items-center gap-3" href={`/admin/users/${u.id}`}>
                        <Avatar name={u.displayName} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium group-hover:text-accent">
                            {u.displayName} <span className="font-normal text-muted">@{u.username}</span>
                          </span>
                          <span className="block truncate text-xs text-muted">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Badge value={u.status} />
                        {u.role !== "user" && <Badge value={u.role} />}
                      </div>
                    </td>
                    <td className="text-right whitespace-nowrap text-muted tabular-nums">
                      {u.contentCount} · {formatBytes(u.storageBytes)}
                    </td>
                    <td className="whitespace-nowrap text-muted">{formatDate(u.createdAt)}</td>
                    <td className="whitespace-nowrap text-muted">{formatDate(u.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination basePath="/admin/users" params={{ q, status }} page={page} hasNext={page * PAGE_SIZE < total} />
    </div>
  );
}
