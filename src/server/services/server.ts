import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import os from "node:os";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { TOS_VERSION } from "@/lib/legal";
import { hasPermission, outranks } from "@/lib/rbac";
import { fieldErrors, inviteSchema, serverSettingsSchema, setupSchema, type FieldErrors } from "@/lib/validation";
import { audit } from "@/server/audit";
import type { CurrentUser } from "@/server/auth/current-user";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { getDb, schema } from "@/server/db";
import type { Invite, ServerSettings } from "@/server/db/schema";
import { requestMeta } from "@/server/request-meta";
import { isUuid, type MutationResult } from "./content";

// ---------------------------------------------------------------- settings

/** This server's settings, or null until the owner has completed /setup. Deduplicated per request. */
export const getServerSettings = cache(async (): Promise<ServerSettings | null> => {
  const db = await getDb();
  const [row] = await db.select().from(schema.serverSettings).where(eq(schema.serverSettings.id, 1)).limit(1);
  return row ?? null;
});

export async function isSetUp(): Promise<boolean> {
  return (await getServerSettings()) !== null;
}

/**
 * First-run: whoever installed OpenShelf creates the server and its owner (admin)
 * account. Possible exactly once; the page is only served to this PC (see /setup).
 */
export async function setupServer(input: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error?: string; fieldErrors?: FieldErrors }> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const { serverName, email, username, displayName, password } = parsed.data;
  const meta = await requestMeta();
  const db = await getDb();
  const passwordHash = await hashPassword(password);

  let ownerId: string;
  try {
    ownerId = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: schema.serverSettings.id }).from(schema.serverSettings).limit(1);
      if (existing) throw new Error("ALREADY_SET_UP");
      const now = new Date();
      const [owner] = await tx
        .insert(schema.users)
        .values({ email, username, displayName, passwordHash, role: "admin", tosVersion: TOS_VERSION, tosAcceptedAt: now, lastLoginAt: now })
        .returning({ id: schema.users.id });
      await tx.insert(schema.tosAcceptances).values({ userId: owner.id, version: TOS_VERSION, ip: meta.ip, userAgent: meta.userAgent });
      await tx.insert(schema.serverSettings).values({ id: 1, name: serverName, joinMode: "invite", lanEnabled: false });
      return owner.id;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_SET_UP") return { ok: false, error: "This server is already set up." };
    const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
    if (code === "23505") return { ok: false, fieldErrors: { email: "That email or username is already in use." } };
    throw err;
  }
  const actor = { id: ownerId, role: "admin" as const };
  await audit({ actor, action: "server.setup", targetType: "user", targetId: ownerId, metadata: { serverName } });
  await createSession(actor);
  return { ok: true };
}

/** Where the launcher reads the network mode from (set by the installed app's runtime helper). */
function writeNetworkFlag(lanEnabled: boolean) {
  const file = process.env.OPENSHELF_NETWORK_FILE;
  if (file) writeFileSync(file, JSON.stringify({ lan: lanEnabled }));
}

export async function updateServerSettings(admin: CurrentUser, input: Record<string, unknown>): Promise<MutationResult> {
  if (!hasPermission(admin, "server:manage")) return { ok: false, status: 403, error: "Not allowed." };
  const parsed = serverSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };
  const db = await getDb();
  await db.update(schema.serverSettings).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.serverSettings.id, 1));
  writeNetworkFlag(parsed.data.lanEnabled);
  await audit({ actor: admin, action: "admin.server.settings", metadata: parsed.data });
  return { ok: true, data: undefined };
}

/** http://<lan-ip>:<port> addresses this PC can be reached at on the local network. */
export function lanAddresses(port: string | number): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== "IPv4" || a.internal) continue;
      // Skip link-local (169.254.x.x): it means "no network", not a reachable address.
      if (a.address.startsWith("169.254.")) continue;
      out.push(`http://${a.address}:${port}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- invites

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createInvite(admin: CurrentUser, input: Record<string, unknown>): Promise<MutationResult<{ token: string }>> {
  if (!hasPermission(admin, "invite:manage")) return { ok: false, status: 403, error: "Not allowed." };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, fieldErrors: fieldErrors(parsed.error) };
  const { expiresInDays, maxUses, note } = parsed.data;
  const token = randomBytes(18).toString("base64url");
  const db = await getDb();
  const [invite] = await db
    .insert(schema.invites)
    .values({
      tokenHash: hashToken(token),
      createdBy: admin.id,
      note,
      maxUses: maxUses || null,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
    })
    .returning({ id: schema.invites.id });
  await audit({ actor: admin, action: "admin.invite.create", targetType: "invite", targetId: invite.id, metadata: { note, maxUses, expiresInDays } });
  return { ok: true, data: { token } };
}

export async function listInvites(admin: CurrentUser): Promise<Invite[]> {
  if (!hasPermission(admin, "invite:manage")) return [];
  const db = await getDb();
  return db.select().from(schema.invites).orderBy(desc(schema.invites.createdAt)).limit(100);
}

export async function revokeInvite(admin: CurrentUser, id: string): Promise<MutationResult> {
  if (!hasPermission(admin, "invite:manage")) return { ok: false, status: 403, error: "Not allowed." };
  if (!isUuid(id)) return { ok: false, status: 404, error: "Invite not found." };
  const db = await getDb();
  await db.update(schema.invites).set({ revokedAt: new Date() }).where(eq(schema.invites.id, id));
  await audit({ actor: admin, action: "admin.invite.revoke", targetType: "invite", targetId: id });
  return { ok: true, data: undefined };
}

export function inviteState(i: Invite): "active" | "revoked" | "expired" | "used up" {
  if (i.revokedAt) return "revoked";
  if (i.expiresAt && i.expiresAt.getTime() <= Date.now()) return "expired";
  if (i.maxUses !== null && i.uses >= i.maxUses) return "used up";
  return "active";
}

const usable = () =>
  and(
    isNull(schema.invites.revokedAt),
    or(isNull(schema.invites.expiresAt), gt(schema.invites.expiresAt, new Date())),
    or(isNull(schema.invites.maxUses), lt(schema.invites.uses, schema.invites.maxUses)),
  );

/** The usable invite for a raw token, or null. */
export async function findUsableInvite(token: unknown): Promise<Invite | null> {
  if (typeof token !== "string" || token.length < 10 || token.length > 100) return null;
  const db = await getDb();
  const [invite] = await db
    .select()
    .from(schema.invites)
    .where(and(eq(schema.invites.tokenHash, hashToken(token)), usable()))
    .limit(1);
  return invite ?? null;
}

// ---------------------------------------------------------------- join requests

export async function decideJoinRequest(admin: CurrentUser, userId: string, approve: boolean): Promise<MutationResult> {
  if (!hasPermission(admin, "user:approve")) return { ok: false, status: 403, error: "Not allowed." };
  if (!isUuid(userId)) return { ok: false, status: 404, error: "Request not found." };
  const db = await getDb();
  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!target || target.status !== "pending") return { ok: false, status: 404, error: "This request was already handled." };
  if (!outranks(admin, target)) return { ok: false, status: 403, error: "Not allowed." };

  if (approve) {
    await db.update(schema.users).set({ status: "active", updatedAt: new Date() }).where(eq(schema.users.id, userId));
  } else {
    // A rejected request leaves nothing behind: the account never became active and owns no content.
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  }
  await audit({
    actor: admin,
    action: approve ? "admin.user.approve" : "admin.user.reject",
    targetType: "user",
    targetId: userId,
    metadata: { username: target.username, email: target.email },
  });
  return { ok: true, data: undefined };
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.users)
    .where(eq(schema.users.status, "pending"));
  return row?.n ?? 0;
}

/** Sends every visitor to the first-run setup until the server has an owner. */
export async function requireSetUp(): Promise<ServerSettings> {
  const settings = await getServerSettings();
  if (!settings) redirect("/setup");
  return settings;
}

/** The addresses people can open this server at, best first: same Wi-Fi (fast), then this PC. */
export async function serverLinks(): Promise<{ local: string; lan: string[]; lanEnabled: boolean }> {
  const settings = await getServerSettings();
  const host = (await headers()).get("host") ?? "localhost";
  const port = host.match(/:(\d+)$/)?.[1] ?? process.env.PORT ?? "80";
  const lanEnabled = Boolean(settings?.lanEnabled);
  return { local: `http://localhost:${port}`, lan: lanEnabled ? lanAddresses(port) : [], lanEnabled };
}
