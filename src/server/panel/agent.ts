import "server-only";
import { readFileSync } from "node:fs";
import { desc, eq, ne, sql } from "drizzle-orm";
import { env } from "@/lib/env";
import { getDb, schema } from "@/server/db";
import { nodeIdentity, panelConfigured, signAsNode } from "./node-identity";

/**
 * Reports this server to the Super Admin panel every minute while it runs:
 * its current tunnel URL (if online) and a summary of members and content.
 * Disclosed to members in the Terms; consent is given once at sign-up.
 */
const INTERVAL_MS = 60_000;
const g = globalThis as unknown as { __panelAgent?: NodeJS.Timeout };

function currentTunnel(): string | null {
  const file = env().OPENSHELF_TUNNEL_FILE;
  if (!file) return null;
  try {
    return (JSON.parse(readFileSync(file, "utf8")) as { url?: string }).url ?? null;
  } catch {
    return null;
  }
}

async function snapshot() {
  const db = await getDb();
  const [settings] = await db.select().from(schema.serverSettings).limit(1);
  const members = await db
    .select({
      username: schema.users.username,
      displayName: schema.users.displayName,
      email: schema.users.email,
      role: schema.users.role,
      status: schema.users.status,
      lastLoginAt: schema.users.lastLoginAt,
    })
    .from(schema.users)
    .where(ne(schema.users.role, "super_admin"))
    .orderBy(desc(schema.users.createdAt))
    .limit(500);
  const content = await db
    .select({
      id: schema.content.id,
      title: schema.content.title,
      owner: schema.users.username,
      visibility: schema.content.visibility,
      status: schema.content.status,
      mimeType: schema.content.mimeType,
      sizeBytes: schema.content.sizeBytes,
      createdAt: schema.content.createdAt,
    })
    .from(schema.content)
    .innerJoin(schema.users, eq(schema.users.id, schema.content.ownerId))
    .orderBy(desc(schema.content.createdAt))
    .limit(500);
  const [totals] = await db
    .select({
      content: sql<number>`count(*)`.mapWith(Number),
      bytes: sql<number>`coalesce(sum(${schema.content.sizeBytes}), 0)`.mapWith(Number),
    })
    .from(schema.content);
  return {
    serverName: settings?.name ?? "Not set up yet",
    stats: {
      members: members.filter((m) => m.status === "active").length,
      pending: members.filter((m) => m.status === "pending").length,
      content: totals?.content ?? 0,
      storageBytes: totals?.bytes ?? 0,
    },
    members,
    content,
  };
}

async function reportOnce() {
  const e = env();
  const id = nodeIdentity();
  if (!id || !e.PANEL_URL) return;
  const snap = await snapshot();
  const body = JSON.stringify({
    nodeId: id.nodeId,
    publicKey: id.publicKey,
    name: snap.serverName,
    version: process.env.OPENSHELF_VERSION ?? "",
    tunnelUrl: currentTunnel(),
    snapshot: snap,
    ts: Date.now(),
  });
  await fetch(`${e.PANEL_URL.replace(/\/$/, "")}/api/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-openshelf-signature": signAsNode(body) },
    body,
    signal: AbortSignal.timeout(15_000),
  });
}

export function startPanelAgent() {
  if (g.__panelAgent || !panelConfigured()) return;
  const tick = () => reportOnce().catch(() => {}); // offline is normal: try again next minute
  setTimeout(tick, 5_000);
  g.__panelAgent = setInterval(tick, INTERVAL_MS);
  g.__panelAgent.unref?.();
}
