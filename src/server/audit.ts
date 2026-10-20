import "server-only";
import { getDb, schema } from "@/server/db";
import type { Role } from "@/lib/rbac";
import { requestMeta } from "@/server/request-meta";

export type AuditAction =
  | "auth.signup"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.tos_accepted"
  | "account.update"
  | "account.password_changed"
  | "account.delete"
  | "content.create"
  | "content.update"
  | "content.delete"
  | "admin.content.view"
  | "admin.content.remove"
  | "admin.content.restore"
  | "admin.content.delete"
  | "admin.user.suspend"
  | "admin.user.unsuspend"
  | "admin.user.remove";

export async function audit(entry: {
  actor: { id: string; role: Role } | null;
  action: AuditAction;
  targetType?: "user" | "content";
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  const { ip } = await requestMeta();
  await db.insert(schema.auditLogs).values({
    actorId: entry.actor?.id ?? null,
    actorRole: entry.actor?.role ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
    ip,
  });
}
