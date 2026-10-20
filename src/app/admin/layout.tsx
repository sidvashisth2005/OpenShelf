import { Activity, LayoutDashboard, Library, Users } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { requirePermission } from "@/server/auth/current-user";

// Each admin page also checks its own permission: layouts don't re-run on every
// navigation, so this check is only a first line of defence.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requirePermission("admin:dashboard");
  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-3">
          <p className="eyebrow px-3 pt-2 pb-3">Super Admin</p>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            <NavLink href="/admin" exact variant="side"><LayoutDashboard /> Overview</NavLink>
            <NavLink href="/admin/users" variant="side"><Users /> Users</NavLink>
            <NavLink href="/admin/content" variant="side"><Library /> Content</NavLink>
            <NavLink href="/admin/audit" variant="side"><Activity /> Activity log</NavLink>
          </nav>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
