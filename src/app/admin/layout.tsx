import { Activity, LayoutDashboard, Library, Link2, MessageCircle, Settings, UserCheck, Users } from "lucide-react";
import { NavLink } from "@/components/nav-link";
import { requirePermission } from "@/server/auth/current-user";
import { getServerSettings, pendingCount } from "@/server/services/server";

// Each admin page also checks its own permission: layouts don't re-run on every
// navigation, so this check is only a first line of defence.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requirePermission("admin:dashboard");
  const [settings, pending] = await Promise.all([getServerSettings(), pendingCount()]);
  return (
    <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-3">
          <div className="px-3 pt-2 pb-3">
            <p className="eyebrow">{user.role === "super_admin" ? "Super Admin" : "Server admin"}</p>
            {settings && <p className="mt-1 truncate text-sm font-semibold">{settings.name}</p>}
          </div>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col">
            <NavLink href="/admin" exact variant="side"><LayoutDashboard /> Overview</NavLink>
            <NavLink href="/admin/users" variant="side"><Users /> Members</NavLink>
            <NavLink href="/admin/requests" variant="side">
              <UserCheck /> Join requests
              {pending > 0 && (
                <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-fg">{pending}</span>
              )}
            </NavLink>
            <NavLink href="/admin/messages" variant="side"><MessageCircle /> Messages</NavLink>
            <NavLink href="/admin/invites" variant="side"><Link2 /> Invite links</NavLink>
            <NavLink href="/admin/content" variant="side"><Library /> Content</NavLink>
            <NavLink href="/admin/audit" variant="side"><Activity /> Activity log</NavLink>
            <NavLink href="/admin/settings" variant="side"><Settings /> Server settings</NavLink>
          </nav>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
