/**
 * Role-based access control.
 *
 * Roles map to permission sets. Adding a role = add it to ROLES (and the
 * `user_role` DB enum via a migration) and give it a permission list below.
 * Code checks permissions, never role names, so new roles slot in without
 * touching call sites.
 *
 *   user        a member of this server
 *   admin       the server owner (whoever installed it): manages members, invites and settings
 *   super_admin the platform owner, configured from env: everything an admin can do
 */

export const ROLES = ["user", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // own content
  "content:create",
  "content:update:own",
  "content:delete:own",
  // content powers over every member
  "content:read:any",
  "content:moderate:any", // remove / restore
  "content:delete:any",
  // member management
  "user:read:any",
  "user:suspend",
  "user:remove",
  "user:approve",
  // monitoring
  "audit:read",
  "admin:dashboard",
  // running the server: join mode, network sharing, invite links
  "server:manage",
  "invite:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MEMBER: readonly Permission[] = ["content:create", "content:update:own", "content:delete:own"];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  user: MEMBER,
  // Members consent to this access once, at sign-up (see src/lib/legal.ts).
  admin: PERMISSIONS,
  super_admin: PERMISSIONS,
};

export type Principal = { id: string; role: Role; status: "active" | "suspended" | "deleted" | "pending" };

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(principal: Principal | null | undefined, permission: Permission): boolean {
  if (!principal || principal.status !== "active") return false;
  return permissionsFor(principal.role).includes(permission);
}

// Higher rank can act on lower rank, never the reverse: the admin cannot suspend the super admin.
const RANK: Record<Role, number> = { user: 0, admin: 1, super_admin: 2 };

export function outranks(actor: { role: Role }, target: { role: Role }): boolean {
  return RANK[actor.role] > RANK[target.role];
}

type Owned = { ownerId: string };

/**
 * Resource-aware check: an `:own` permission is satisfied by ownership, and the
 * matching `:any` permission (if any) overrides ownership.
 */
export function can(
  principal: Principal | null | undefined,
  action: "update" | "delete",
  resource: Owned,
): boolean {
  if (!principal || principal.status !== "active") return false;
  if (action === "delete" && hasPermission(principal, "content:delete:any")) return true;
  // There is deliberately no `content:update:any`: moderators remove or restore,
  // they never rewrite someone else's words.
  const own: Permission = action === "update" ? "content:update:own" : "content:delete:own";
  return resource.ownerId === principal.id && hasPermission(principal, own);
}

/** Whether the principal may view a content item given its visibility/status. */
export function canView(
  principal: Principal | null | undefined,
  item: Owned & { visibility: "public" | "unlisted" | "private"; status: "published" | "draft" | "removed" },
): boolean {
  if (hasPermission(principal, "content:read:any")) return true;
  // Owners always see their own items, including removed ones (with the reason).
  if (principal && principal.status === "active" && item.ownerId === principal.id) return true;
  if (item.status === "removed") return false;
  return item.status === "published" && item.visibility !== "private";
}
