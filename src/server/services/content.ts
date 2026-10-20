import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { env } from "@/lib/env";
import { can, canView, hasPermission } from "@/lib/rbac";
import { contentFieldsSchema, fieldErrors, reasonSchema, type FieldErrors } from "@/lib/validation";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { getDb, schema } from "@/server/db";
import { escapeLike } from "@/server/db/like";
import type { Content } from "@/server/db/schema";
import { checkUploadType } from "@/lib/file-types";
import { storage } from "@/server/storage";

export const PAGE_SIZE = 24;

export type ContentWithOwner = Content & {
  owner: { id: string; username: string; displayName: string; status: "active" | "suspended" | "deleted" };
};

export type MutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 403 | 404; error?: string; fieldErrors?: FieldErrors };

const ownerColumns = {
  id: schema.users.id,
  username: schema.users.username,
  displayName: schema.users.displayName,
  status: schema.users.status,
};

async function selectWithOwner(where: SQL | undefined, opts: { limit: number; offset?: number }) {
  const db = await getDb();
  const rows = await db
    .select({ item: schema.content, owner: ownerColumns })
    .from(schema.content)
    .innerJoin(schema.users, eq(schema.users.id, schema.content.ownerId))
    .where(where)
    .orderBy(desc(schema.content.createdAt))
    .limit(opts.limit)
    .offset(opts.offset ?? 0);
  return rows.map(({ item, owner }) => ({ ...item, owner }));
}

// Content is visible in public listings only if its owner is still active.
const publiclyListed = and(
  eq(schema.content.status, "published"),
  eq(schema.content.visibility, "public"),
  eq(schema.users.status, "active"),
);

export async function listPublicFeed(page: number): Promise<ContentWithOwner[]> {
  return selectWithOwner(publiclyListed, { limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE });
}

export async function listPublicByUsername(username: string, page: number) {
  return selectWithOwner(and(publiclyListed, sql`lower(${schema.users.username}) = ${username.toLowerCase()}`), {
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });
}

export async function listOwn(user: CurrentUser): Promise<ContentWithOwner[]> {
  return selectWithOwner(eq(schema.content.ownerId, user.id), { limit: 500 });
}

/**
 * Loads an item for a viewer, enforcing visibility. When an admin opens content
 * that isn't public (and isn't theirs), the access is written to the audit log.
 */
export async function getContentForViewer(
  viewer: CurrentUser | null,
  id: string,
  opts: { logAdminAccess: boolean },
): Promise<ContentWithOwner | null> {
  if (!isUuid(id)) return null;
  const [item] = await selectWithOwner(eq(schema.content.id, id), { limit: 1 });
  if (!item) return null;

  // Content of suspended/removed accounts is hidden from everyone but its owner and admins.
  const ownerHidden = item.owner.status !== "active" && item.ownerId !== viewer?.id;
  const isAdmin = hasPermission(viewer, "content:read:any");
  if (!canView(viewer, item) || (ownerHidden && !isAdmin)) return null;

  const isPublic = item.status === "published" && item.visibility !== "private" && !ownerHidden;
  if (opts.logAdminAccess && viewer && isAdmin && item.ownerId !== viewer.id && !isPublic) {
    await audit({
      actor: viewer,
      action: "admin.content.view",
      targetType: "content",
      targetId: item.id,
      metadata: { ownerId: item.ownerId, visibility: item.visibility, status: item.status },
    });
  }
  return item;
}

export async function createContent(user: CurrentUser, form: FormData): Promise<MutationResult<{ id: string }>> {
  if (!hasPermission(user, "content:create")) return { ok: false, status: 403, error: "You can't upload content." };

  const parsed = contentFieldsSchema.safeParse({
    title: form.get("title"),
    description: form.get("description") ?? "",
    visibility: form.get("visibility"),
    status: form.get("status"),
  });
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, status: 400, fieldErrors: { file: "Choose a file to upload." } };
  }
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { ok: false, status: 400, fieldErrors: { file: `Files can be at most ${env().MAX_UPLOAD_MB} MB.` } };
  }
  const type = checkUploadType(file.name, file.type);
  if ("error" in type) return { ok: false, status: 400, fieldErrors: { file: type.error } };

  const id = randomUUID();
  const storageKey = `${user.id}/${id}.${type.ext}`;
  await storage().put(storageKey, file.stream());

  const db = await getDb();
  try {
    await db.insert(schema.content).values({
      id,
      ownerId: user.id,
      ...parsed.data,
      storageKey,
      fileName: file.name.slice(0, 255),
      mimeType: type.mime,
      sizeBytes: file.size,
    });
  } catch (err) {
    await storage().delete(storageKey);
    throw err;
  }

  await audit({
    actor: user,
    action: "content.create",
    targetType: "content",
    targetId: id,
    metadata: { title: parsed.data.title, mimeType: type.mime, sizeBytes: file.size, visibility: parsed.data.visibility },
  });
  return { ok: true, data: { id } };
}

async function findItem(id: string) {
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [item] = await db.select().from(schema.content).where(eq(schema.content.id, id)).limit(1);
  return item ?? null;
}

export async function updateContent(user: CurrentUser, id: string, form: FormData): Promise<MutationResult> {
  const item = await findItem(id);
  if (!item) return { ok: false, status: 404, error: "Content not found." };
  if (!can(user, "update", item)) return { ok: false, status: 403, error: "You can only edit your own content." };
  if (item.status === "removed") {
    return { ok: false, status: 403, error: "This content was removed by a moderator and can't be edited." };
  }

  const parsed = contentFieldsSchema.safeParse({
    title: form.get("title"),
    description: form.get("description") ?? "",
    visibility: form.get("visibility"),
    status: form.get("status"),
  });
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };

  const db = await getDb();
  await db.update(schema.content).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.content.id, id));
  await audit({ actor: user, action: "content.update", targetType: "content", targetId: id, metadata: parsed.data });
  return { ok: true, data: undefined };
}

/** Permanent delete (row + stored file). Owners delete their own; admins can delete anything. */
export async function deleteContent(user: CurrentUser, id: string, reason?: string): Promise<MutationResult> {
  const item = await findItem(id);
  if (!item) return { ok: false, status: 404, error: "Content not found." };
  if (!can(user, "delete", item)) return { ok: false, status: 403, error: "You can only delete your own content." };

  const asAdmin = item.ownerId !== user.id;
  if (asAdmin) {
    const r = reasonSchema.safeParse(reason ?? "");
    if (!r.success) return { ok: false, status: 400, fieldErrors: { reason: r.error.issues[0].message } };
    reason = r.data;
  }

  const db = await getDb();
  await db.delete(schema.content).where(eq(schema.content.id, id));
  await storage().delete(item.storageKey);
  await audit({
    actor: user,
    action: asAdmin ? "admin.content.delete" : "content.delete",
    targetType: "content",
    targetId: id,
    metadata: { title: item.title, ownerId: item.ownerId, ...(asAdmin ? { reason } : {}) },
  });
  return { ok: true, data: undefined };
}

export async function moderateContent(
  admin: CurrentUser,
  id: string,
  action: "remove" | "restore",
  reason: string,
): Promise<MutationResult> {
  if (!hasPermission(admin, "content:moderate:any")) return { ok: false, status: 403, error: "Not allowed." };
  const item = await findItem(id);
  if (!item) return { ok: false, status: 404, error: "Content not found." };

  const db = await getDb();
  if (action === "remove") {
    const r = reasonSchema.safeParse(reason);
    if (!r.success) return { ok: false, status: 400, fieldErrors: { reason: r.error.issues[0].message } };
    if (item.status === "removed") return { ok: false, status: 400, error: "Already removed." };
    await db
      .update(schema.content)
      .set({
        status: "removed",
        statusBeforeRemoval: item.status,
        removedReason: r.data,
        removedBy: admin.id,
        removedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.content.id, id));
    await audit({
      actor: admin,
      action: "admin.content.remove",
      targetType: "content",
      targetId: id,
      metadata: { reason: r.data, ownerId: item.ownerId, title: item.title },
    });
  } else {
    if (item.status !== "removed") return { ok: false, status: 400, error: "This content isn't removed." };
    await db
      .update(schema.content)
      .set({
        status: item.statusBeforeRemoval ?? "draft",
        statusBeforeRemoval: null,
        removedReason: null,
        removedBy: null,
        removedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.content.id, id));
    await audit({
      actor: admin,
      action: "admin.content.restore",
      targetType: "content",
      targetId: id,
      metadata: { ownerId: item.ownerId, title: item.title },
    });
  }
  return { ok: true, data: undefined };
}

export async function adminListContent(
  admin: CurrentUser,
  filters: { q?: string; status?: string; ownerId?: string; page: number },
): Promise<{ items: ContentWithOwner[]; total: number }> {
  if (!hasPermission(admin, "content:read:any")) return { items: [], total: 0 };
  const conds: (SQL | undefined)[] = [];
  if (filters.q) {
    const like = `%${escapeLike(filters.q)}%`;
    conds.push(or(ilike(schema.content.title, like), ilike(schema.content.fileName, like), ilike(schema.users.username, like)));
  }
  if (filters.status === "published" || filters.status === "draft" || filters.status === "removed") {
    conds.push(eq(schema.content.status, filters.status));
  }
  if (filters.ownerId && isUuid(filters.ownerId)) conds.push(eq(schema.content.ownerId, filters.ownerId));
  const where = conds.length ? and(...conds) : undefined;

  const db = await getDb();
  const [items, [{ total }]] = await Promise.all([
    selectWithOwner(where, { limit: PAGE_SIZE, offset: (filters.page - 1) * PAGE_SIZE }),
    db
      .select({ total: count() })
      .from(schema.content)
      .innerJoin(schema.users, eq(schema.users.id, schema.content.ownerId))
      .where(where),
  ]);
  return { items, total };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
