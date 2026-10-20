import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { superAdminConfig } from "@/lib/env";
import { TOS_VERSION } from "@/lib/legal";
import type { Role } from "@/lib/rbac";
import { fieldErrors, loginSchema, signupSchema, type FieldErrors } from "@/lib/validation";
import { audit } from "@/server/audit";
import { checkHuman } from "@/server/bot-check";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { getDb, schema } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import { rateLimit } from "@/server/rate-limit";
import { requestMeta } from "@/server/request-meta";

export type AuthResult = { ok: true } | { ok: false; error?: string; fieldErrors?: FieldErrors };

const SUPER_ADMIN_USERNAME = "superadmin";
const emailEquals = (email: string) => sql`lower(${schema.users.email}) = ${email}`;

export async function signup(input: Record<string, unknown>): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const { email, username, displayName, password } = parsed.data;

  const meta = await requestMeta();
  if (!rateLimit(`signup:${meta.ip}`, 10, 60 * 60_000).ok) {
    return { ok: false, error: "Too many sign-ups from this network. Try again later." };
  }
  const botError = await checkHuman(input, meta.ip);
  if (botError) return { ok: false, error: botError };
  // The super admin account comes from config only, never from signup.
  if (superAdminConfig()?.email === email) {
    return { ok: false, fieldErrors: { email: "This email can't be used to register." } };
  }

  const db = await getDb();
  const taken = await findTaken(email, username);
  if (taken) return { ok: false, fieldErrors: taken };

  const passwordHash = await hashPassword(password);
  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      const now = new Date();
      const [user] = await tx
        .insert(schema.users)
        .values({
          email,
          username,
          displayName,
          passwordHash,
          role: "user",
          tosVersion: TOS_VERSION,
          tosAcceptedAt: now,
          lastLoginAt: now,
        })
        .returning({ id: schema.users.id });
      await tx
        .insert(schema.tosAcceptances)
        .values({ userId: user.id, version: TOS_VERSION, ip: meta.ip, userAgent: meta.userAgent });
      return user.id;
    });
  } catch (err) {
    // Lost a race with a concurrent signup for the same email/username.
    if (!isUniqueViolation(err)) throw err;
    return { ok: false, fieldErrors: (await findTaken(email, username)) ?? { email: "That account already exists." } };
  }

  const actor = { id: userId, role: "user" as const };
  await audit({ actor, action: "auth.signup", targetType: "user", targetId: userId });
  await audit({ actor, action: "auth.tos_accepted", targetType: "user", targetId: userId, metadata: { version: TOS_VERSION } });
  await createSession(actor);
  return { ok: true };
}

async function findTaken(email: string, username: string): Promise<FieldErrors | null> {
  const db = await getDb();
  const rows = await db
    .select({ email: schema.users.email, username: schema.users.username })
    .from(schema.users)
    .where(or(emailEquals(email), sql`lower(${schema.users.username}) = ${username}`))
    .limit(2);
  if (rows.some((r) => r.email.toLowerCase() === email)) return { email: "An account with this email already exists." };
  if (rows.length) return { username: "That username is taken." };
  return null;
}

export async function login(input: Record<string, unknown>): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const { email, password } = parsed.data;

  const meta = await requestMeta();
  const limits = [rateLimit(`login:ip:${meta.ip}`, 30, 15 * 60_000), rateLimit(`login:email:${email}`, 8, 15 * 60_000)];
  if (limits.some((r) => !r.ok)) {
    return { ok: false, error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }

  const generic: AuthResult = { ok: false, error: "Incorrect email or password." };
  const admin = superAdminConfig();

  if (admin && admin.email === email) {
    if (!(await verifyPassword(password, admin.passwordHash))) {
      await audit({ actor: null, action: "auth.login_failed", metadata: { email, superAdmin: true } });
      return generic;
    }
    const adminUser = await ensureSuperAdminRow(admin.email);
    if (!adminUser) {
      return {
        ok: false,
        error: "The configured super admin email belongs to a regular account. Configure a different SUPER_ADMIN_EMAIL.",
      };
    }
    await finishLogin(adminUser);
    return { ok: true };
  }

  const db = await getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(and(emailEquals(email), eq(schema.users.role, "user")))
    .limit(1);

  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid || user.status === "deleted") {
    await audit({
      actor: null,
      action: "auth.login_failed",
      targetType: user ? "user" : undefined,
      targetId: user?.id,
      metadata: { email },
    });
    return generic;
  }
  // Status is revealed only after a correct password, so it can't be probed.
  if (user.status === "suspended") {
    return { ok: false, error: `This account is suspended.${user.statusReason ? ` Reason: ${user.statusReason}` : ""}` };
  }

  await finishLogin(user);
  return { ok: true };
}

async function finishLogin(user: { id: string; role: Role }) {
  const db = await getDb();
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await audit({ actor: user, action: "auth.login", targetType: "user", targetId: user.id });
  await createSession(user);
}

/**
 * Makes sure exactly one super admin row exists, matching the configured email.
 * The row has no password hash: the credential only ever lives in env config.
 * Returns null if that email is already used by a regular account.
 */
async function ensureSuperAdminRow(email: string): Promise<{ id: string; role: "super_admin" } | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.users).where(emailEquals(email)).limit(1);
    if (existing && existing.role !== "super_admin") return null;

    // If the configured email changed, the previous super admin loses the role.
    const stale = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.role, "super_admin"), ne(sql`lower(${schema.users.email})`, email)));
    for (const row of stale) {
      await tx
        .update(schema.users)
        .set({
          role: "user",
          status: "suspended",
          statusReason: "Former super admin account",
          username: `former-admin-${randomUUID().slice(0, 8)}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, row.id));
      await tx.delete(schema.sessions).where(eq(schema.sessions.userId, row.id));
    }

    if (existing) return { id: existing.id, role: "super_admin" as const };
    const [created] = await tx
      .insert(schema.users)
      .values({
        email,
        username: SUPER_ADMIN_USERNAME,
        displayName: "Super Admin",
        passwordHash: null,
        role: "super_admin",
        status: "active",
      })
      .returning({ id: schema.users.id });
    return { id: created.id, role: "super_admin" as const };
  });
}
