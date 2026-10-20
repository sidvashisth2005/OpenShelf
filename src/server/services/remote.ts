import "server-only";
import path from "node:path";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { headers } from "next/headers";
import type { MutationResult } from "./content";
import { isSetUp } from "./server";

/**
 * "Join a team's server" on a fresh install: instead of becoming its own server, this PC
 * remembers another OpenShelf server and opens that one. The launcher reads the same file
 * (OPENSHELF_REMOTE_FILE, set by installer/app/openshelf.mjs) to open the right address.
 */

export type RemoteServer = { url: string; joinUrl: string };

const remoteFile = () => process.env.OPENSHELF_REMOTE_FILE || path.resolve(".data", "remote.json");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const JOIN_PATH = /^\/join\/[A-Za-z0-9_-]{20,}$/;

export function getRemoteServer(): RemoteServer | null {
  try {
    const file = remoteFile();
    if (!existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, "utf8")) as RemoteServer;
    return typeof data.url === "string" && typeof data.joinUrl === "string" ? data : null;
  } catch {
    return null;
  }
}

/** Only the PC OpenShelf runs on may change this, and only before it is set up as a server. */
async function guard(): Promise<MutationResult | null> {
  const host = ((await headers()).get("host") ?? "").replace(/:\d+$/, "").toLowerCase();
  if (!LOCAL_HOSTS.has(host) || (await isSetUp())) return { ok: false, status: 403, error: "Not available." };
  return null;
}

export async function connectToRemote(input: Record<string, unknown>): Promise<MutationResult<RemoteServer>> {
  const denied = await guard();
  if (denied && !denied.ok) return denied;
  const raw = typeof input.inviteUrl === "string" ? input.inviteUrl.trim() : "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, status: 400, fieldErrors: { inviteUrl: "Paste the whole invite link, starting with http." } };
  }
  if (!["http:", "https:"].includes(url.protocol) || !JOIN_PATH.test(url.pathname)) {
    return { ok: false, status: 400, fieldErrors: { inviteUrl: "That isn't an OpenShelf invite link (it should contain /join/)." } };
  }
  if (LOCAL_HOSTS.has(url.hostname)) {
    return { ok: false, status: 400, fieldErrors: { inviteUrl: "That's a link to this PC. Use the admin's \"same Wi-Fi\" link instead." } };
  }
  const remote = { url: url.origin, joinUrl: `${url.origin}${url.pathname}` };
  const file = remoteFile();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(remote));
  return { ok: true, data: remote };
}

export async function disconnectRemote(): Promise<MutationResult> {
  const denied = await guard();
  if (denied && !denied.ok) return denied;
  rmSync(remoteFile(), { force: true });
  return { ok: true, data: undefined };
}
