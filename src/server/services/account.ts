import "server-only";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/rbac";
import { changePasswordSchema, deleteAccountSchema, fieldErrors, profileSchema } from "@/lib/validation";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroyAllSessionsForUser } from "@/server/auth/session";
import { getDb, schema } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { storage } from "@/server/storage";
import type { MutationResult } from "./content";

// The super admin's credential and identity live in env config, not here.
const SELF_SERVICE_ONLY: MutationResult = {
  ok: false,
  status: 403,
  error: "The super admin account is managed through server configuration.",
};

async function passwordHashOf(userId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row?.hash ?? null;
}

function checkAttempts(user: CurrentUser): MutationResult | null {
  return rateLimit(`reauth:${user.id}`, 8, 15 * 60_000).ok
    ? null
    : { ok: false, status: 400, error: "Too many attempts. Wait a few minutes and try again." };
}

export async function updateProfile(user: CurrentUser, input: Record<string, unknown>): Promise<MutationResult> {
  if (user.role === "super_admin") return SELF_SERVICE_ONLY;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };

  const db = await getDb();
  await db.update(schema.users).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.users.id, user.id));
  await audit({ actor: user, action: "account.update", targetType: "user", targetId: user.id, metadata: parsed.data });
  return { ok: true, data: undefined };
}

/** Changes the password and signs out every other session. */
export async function changePassword(user: CurrentUser, input: Record<string, unknown>): Promise<MutationResult> {
  if (user.role === "super_admin") return SELF_SERVICE_ONLY;
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };
  const limited = checkAttempts(user);
  if (limited) return limited;

  if (!(await verifyPassword(parsed.data.currentPassword, await passwordHashOf(user.id)))) {
    return { ok: false, status: 400, fieldErrors: { currentPassword: "That isn't your current password." } };
  }

  const db = await getDb();
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));
  await destroyAllSessionsForUser(user.id);
  await createSession(user);
  await audit({ actor: user, action: "account.password_changed", targetType: "user", targetId: user.id });
  return { ok: true, data: undefined };
}

/**
 * Self-service account deletion. All content (rows and stored files) is erased.
 * The user row stays as an anonymized tombstone so audit-log references remain
 * valid, but every piece of personal profile data is scrubbed from it.
 */
export async function deleteOwnAccount(user: CurrentUser, input: Record<string, unknown>): Promise<MutationResult> {
  if (user.role === "super_admin" || hasPermission(user, "admin:dashboard")) return SELF_SERVICE_ONLY;
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };
  const limited = checkAttempts(user);
  if (limited) return limited;

  if (!(await verifyPassword(parsed.data.password, await passwordHashOf(user.id)))) {
    return { ok: false, status: 400, fieldErrors: { password: "Incorrect password." } };
  }

  const db = await getDb();
  const items = await db
    .select({ id: schema.content.id, storageKey: schema.content.storageKey })
    .from(schema.content)
    .where(eq(schema.content.ownerId, user.id));

  const tombstone = `deleted-${user.id.slice(0, 8)}`;
  await db.transaction(async (tx) => {
    await tx.delete(schema.content).where(eq(schema.content.ownerId, user.id));
    await tx
      .update(schema.users)
      .set({
        email: `${user.id}@deleted.invalid`,
        username: tombstone,
        displayName: "Deleted user",
        passwordHash: null,
        status: "deleted",
        statusReason: "Deleted by the account owner",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));
  });
  // Files go after the rows are gone, so a failure here can't leave dangling content.
  await Promise.all(items.map((i) => storage().delete(i.storageKey)));
  await destroyAllSessionsForUser(user.id);
  await audit({
    actor: user,
    action: "account.delete",
    targetType: "user",
    targetId: user.id,
    metadata: { contentDeleted: items.length },
  });
  return { ok: true, data: undefined };
}
