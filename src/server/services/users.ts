import "server-only";
import { and, count, desc, eq, gte, ilike, ne, or, sql, sum, type SQL } from "drizzle-orm";
import { hasPermission, outranks } from "@/lib/rbac";
import { reasonSchema } from "@/lib/validation";
import { audit, type AuditAction } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { destroyAllSessionsForUser } from "@/server/auth/session";
import { getDb, schema } from "@/server/db";
import { escapeLike } from "@/server/db/like";
import { isUuid, PAGE_SIZE, type MutationResult } from "./content";

export async function adminListUsers(admin: CurrentUser, filters: { q?: string; status?: string; page: number }) {
  if (!hasPermission(admin, "user:read:any")) return { users: [], total: 0 };
  const conds: (SQL | undefined)[] = [];
  if (filters.q) {
    const like = `%${escapeLike(filters.q)}%`;
    conds.push(or(ilike(schema.users.email, like), ilike(schema.users.username, like), ilike(schema.users.displayName, like)));
  }
  if (filters.status === "active" || filters.status === "suspended" || filters.status === "deleted" || filters.status === "pending") {
    conds.push(eq(schema.users.status, filters.status));
  }
  const where = conds.length ? and(...conds) : undefined;

  const db = await getDb();
  const contentCount = db
    .select({ ownerId: schema.content.ownerId, n: count().as("n"), bytes: sum(schema.content.sizeBytes).as("bytes") })
    .from(schema.content)
    .groupBy(schema.content.ownerId)
    .as("cc");

  const [users, [{ total }]] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        displayName: schema.users.displayName,
        role: schema.users.role,
        status: schema.users.status,
        createdAt: schema.users.createdAt,
        lastLoginAt: schema.users.lastLoginAt,
        contentCount: sql<number>`coalesce(${contentCount.n}, 0)`.mapWith(Number),
        storageBytes: sql<number>`coalesce(${contentCount.bytes}, 0)`.mapWith(Number),
      })
      .from(schema.users)
      .leftJoin(contentCount, eq(contentCount.ownerId, schema.users.id))
      .where(where)
      .orderBy(desc(schema.users.createdAt))
      .limit(PAGE_SIZE)
      .offset((filters.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(schema.users).where(where),
  ]);
  return { users, total };
}

export async function adminGetUser(admin: CurrentUser, id: string) {
  if (!hasPermission(admin, "user:read:any") || !isUuid(id)) return null;
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!user) return null;
  const tos = await db
    .select()
    .from(schema.tosAcceptances)
    .where(eq(schema.tosAcceptances.userId, id))
    .orderBy(desc(schema.tosAcceptances.acceptedAt));
  // Never hand the password hash to a page, even an admin one.
  const safe = { ...user, passwordHash: undefined };
  return { user: safe, tosAcceptances: tos };
}

type UserAction = "suspend" | "unsuspend" | "remove";

const ACTION_PERMISSION = { suspend: "user:suspend", unsuspend: "user:suspend", remove: "user:remove" } as const;
const ACTION_AUDIT: Record<UserAction, AuditAction> = {
  suspend: "admin.user.suspend",
  unsuspend: "admin.user.unsuspend",
  remove: "admin.user.remove",
};

export async function adminUserAction(
  admin: CurrentUser,
  id: string,
  action: UserAction,
  reason: string,
): Promise<MutationResult> {
  if (!hasPermission(admin, ACTION_PERMISSION[action])) return { ok: false, status: 403, error: "Not allowed." };
  if (!isUuid(id)) return { ok: false, status: 404, error: "User not found." };

  let cleanReason: string | null = null;
  if (action !== "unsuspend") {
    const r = reasonSchema.safeParse(reason);
    if (!r.success) return { ok: false, status: 400, fieldErrors: { reason: r.error.issues[0].message } };
    cleanReason = r.data;
  }

  const db = await getDb();
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!target) return { ok: false, status: 404, error: "User not found." };
  // Nobody can act on themselves or on an equal/higher role (the admin can't lock out the super admin).
  if (target.id === admin.id || !outranks(admin, target)) {
    return { ok: false, status: 403, error: "You can't change this account." };
  }
  if (target.status === "deleted") return { ok: false, status: 400, error: "This account was already removed." };

  if (action === "suspend") {
    if (target.status === "suspended") return { ok: false, status: 400, error: "Already suspended." };
    await db.update(schema.users).set({ status: "suspended", statusReason: cleanReason, updatedAt: new Date() }).where(eq(schema.users.id, id));
    await destroyAllSessionsForUser(id);
  } else if (action === "unsuspend") {
    if (target.status !== "suspended") return { ok: false, status: 400, error: "This account isn't suspended." };
    await db.update(schema.users).set({ status: "active", statusReason: null, updatedAt: new Date() }).where(eq(schema.users.id, id));
  } else {
    // Soft removal: the account is closed and its content taken down, but rows
    // stay so the audit trail keeps pointing at real records.
    await db.transaction(async (tx) => {
      const now = new Date();
      await tx.update(schema.users).set({ status: "deleted", statusReason: cleanReason, updatedAt: now }).where(eq(schema.users.id, id));
      await tx
        .update(schema.content)
        .set({
          statusBeforeRemoval: sql`${schema.content.status}`,
          status: "removed",
          removedReason: `Account removed: ${cleanReason}`,
          removedBy: admin.id,
          removedAt: now,
          updatedAt: now,
        })
        .where(and(eq(schema.content.ownerId, id), ne(schema.content.status, "removed")));
    });
    await destroyAllSessionsForUser(id);
  }

  await audit({
    actor: admin,
    action: ACTION_AUDIT[action],
    targetType: "user",
    targetId: id,
    metadata: { username: target.username, ...(cleanReason ? { reason: cleanReason } : {}) },
  });
  return { ok: true, data: undefined };
}

export async function platformStats(admin: CurrentUser) {
  if (!hasPermission(admin, "admin:dashboard")) return null;
  const db = await getDb();
  const since = new Date(Date.now() - 86_400_000);
  const [usersByStatus, contentByStatus, [storage], [newUsers], [newContent], [failedLogins], [activeSessions]] =
    await Promise.all([
      db.select({ status: schema.users.status, n: count() }).from(schema.users).where(eq(schema.users.role, "user")).groupBy(schema.users.status),
      db.select({ status: schema.content.status, n: count() }).from(schema.content).groupBy(schema.content.status),
      db.select({ bytes: sql<number>`coalesce(sum(${schema.content.sizeBytes}), 0)`.mapWith(Number) }).from(schema.content),
      db.select({ n: count() }).from(schema.users).where(and(eq(schema.users.role, "user"), gte(schema.users.createdAt, since))),
      db.select({ n: count() }).from(schema.content).where(gte(schema.content.createdAt, since)),
      db.select({ n: count() }).from(schema.auditLogs).where(and(eq(schema.auditLogs.action, "auth.login_failed"), gte(schema.auditLogs.createdAt, since))),
      db.select({ n: count() }).from(schema.sessions).where(gte(schema.sessions.expiresAt, new Date())),
    ]);
  const byStatus = <T extends string>(rows: { status: T; n: number }[]) =>
    Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<T, number>>;
  return {
    users: byStatus(usersByStatus),
    content: byStatus(contentByStatus),
    storageBytes: storage.bytes,
    last24h: { newUsers: newUsers.n, newContent: newContent.n, failedLogins: failedLogins.n },
    activeSessions: activeSessions.n,
  };
}

export async function adminListAudit(
  admin: CurrentUser,
  filters: { action?: string; actorId?: string; targetId?: string; page: number },
) {
  const pageSize = 50;
  if (!hasPermission(admin, "audit:read")) return { entries: [], total: 0, pageSize };
  const conds: (SQL | undefined)[] = [];
  if (filters.action) conds.push(ilike(schema.auditLogs.action, `${escapeLike(filters.action)}%`));
  if (filters.actorId && isUuid(filters.actorId)) conds.push(eq(schema.auditLogs.actorId, filters.actorId));
  if (filters.targetId && isUuid(filters.targetId)) conds.push(eq(schema.auditLogs.targetId, filters.targetId));
  const where = conds.length ? and(...conds) : undefined;

  const db = await getDb();
  const [entries, [{ total }]] = await Promise.all([
    db
      .select({ entry: schema.auditLogs, actorUsername: schema.users.username })
      .from(schema.auditLogs)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
      .where(where)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(pageSize)
      .offset((filters.page - 1) * pageSize),
    db.select({ total: count() }).from(schema.auditLogs).where(where),
  ]);
  return { entries, total, pageSize };
}

/** Public profile of an active regular user, or null. */
export async function getPublicProfile(username: string) {
  const db = await getDb();
  const [profile] = await db
    .select({ username: schema.users.username, displayName: schema.users.displayName })
    .from(schema.users)
    .where(
      and(
        sql`lower(${schema.users.username}) = ${username.toLowerCase()}`,
        eq(schema.users.status, "active"),
        // Members and the server admin have public profiles; the platform Super Admin doesn't.
        ne(schema.users.role, "super_admin"),
      ),
    )
    .limit(1);
  return profile ?? null;
}
