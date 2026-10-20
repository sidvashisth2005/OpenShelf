/**
 * Role-based access control.
 *
 * Roles map to permission sets. Adding a role = add it to ROLES (and the
 * `user_role` DB enum via a migration) and give it a permission list below.
 * Code checks permissions, never role names, so new roles slot in without
 * touching call sites.
 */

export const ROLES = ["user", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // own content
  "content:create",
  "content:update:own",
  "content:delete:own",
  // platform-wide content powers
  "content:read:any",
  "content:moderate:any", // remove / restore
  "content:delete:any",
  // user management
  "user:read:any",
  "user:suspend",
  "user:remove",
  // monitoring
  "audit:read",
  "admin:dashboard",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  user: ["content:create", "content:update:own", "content:delete:own"],
  super_admin: PERMISSIONS,
};

export type Principal = { id: string; role: Role; status: "active" | "suspended" | "deleted" };

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(principal: Principal | null | undefined, permission: Permission): boolean {
  if (!principal || principal.status !== "active") return false;
  return permissionsFor(principal.role).includes(permission);
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
