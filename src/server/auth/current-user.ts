import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { superAdminConfig } from "@/lib/env";
import { hasPermission, type Permission, type Principal } from "@/lib/rbac";
import { readSessionUser } from "./session";

export type CurrentUser = Principal & {
  email: string;
  username: string;
  displayName: string;
  tosVersion: string | null;
};

/**
 * Data Access Layer entry point: the one place that turns a cookie into a user.
 * Deduplicated per request via React `cache`.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const row = await readSessionUser();
  if (!row || row.status !== "active") return null;

  // Env config is the source of truth for who the super admin is. If the
  // configured email changes (or admin login is disabled), an old super admin
  // session stops working immediately.
  if (row.role === "super_admin") {
    const cfg = superAdminConfig();
    if (!cfg || cfg.email !== row.email.toLowerCase()) return null;
  }

  return {
    id: row.id,
    role: row.role,
    status: row.status,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
    tosVersion: row.tosVersion,
  };
});

/** For pages: the signed-in user, or a redirect to login. */
export async function requireUser(opts: { next?: string } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(opts.next ? `/login?next=${encodeURIComponent(opts.next)}` : "/login");
  return user;
}

/** For pages: 404 (not 403) so admin surfaces aren't discoverable. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) notFound();
  return user;
}

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
  }
}

/** For Server Actions / Route Handlers: throws instead of redirecting. */
export async function assertPermission(permission?: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Please sign in.");
  if (permission && !hasPermission(user, permission)) throw new AuthError(403, "You don't have permission to do that.");
  return user;
}
