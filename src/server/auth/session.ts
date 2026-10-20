import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { env } from "@/lib/env";
import type { Role } from "@/lib/rbac";
import { getDb, schema } from "@/server/db";
import { requestMeta } from "@/server/request-meta";

// HTTPS gets a locked-down __Host- cookie. Plain http (localhost, or a LAN address when the server is
// shared on Wi-Fi) cannot store Secure cookies, so it gets an ordinary HttpOnly one instead.
const SECURE_COOKIE = "__Host-session";
const PLAIN_COOKIE = "session";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function isHttps(): Promise<boolean> {
  if (process.env.FORCE_HTTPS === "true") return true;
  return (await headers()).get("x-forwarded-proto") === "https";
}

async function readToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SECURE_COOKIE)?.value ?? jar.get(PLAIN_COOKIE)?.value;
}

function ttlMs(role: Role): number {
  const e = env();
  // The super admin gets a much shorter session: it's the most powerful credential.
  return role === "super_admin" ? e.ADMIN_SESSION_TTL_HOURS * 3_600_000 : e.SESSION_TTL_DAYS * 86_400_000;
}

export async function createSession(user: { id: string; role: Role }): Promise<void> {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs(user.role));
  const { ip, userAgent } = await requestMeta();

  await db.insert(schema.sessions).values({ id: hashToken(token), userId: user.id, expiresAt, ip, userAgent });
  // Opportunistic cleanup of expired sessions (indexed on expires_at).
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));

  const secure = await isHttps();
  (await cookies()).set(secure ? SECURE_COOKIE : PLAIN_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Returns the user row for a valid, unexpired session cookie, or null. */
export async function readSessionUser(): Promise<typeof schema.users.$inferSelect | null> {
  const token = await readToken();
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function destroyCurrentSession(): Promise<void> {
  const token = await readToken();
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  const jar = await cookies();
  jar.delete(SECURE_COOKIE);
  jar.delete(PLAIN_COOKIE);
}

export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}
