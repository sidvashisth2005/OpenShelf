import "server-only";
import { createHmac, createPrivateKey, createPublicKey, sign, timingSafeEqual, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { env } from "@/lib/env";

/**
 * This server's identity towards the Super Admin panel. The key file is created by
 * the installed app's launcher (openshelf.mjs) the first time it starts:
 *   { nodeId, publicKey (raw Ed25519, base64url), privateKey (PKCS#8 DER, base64), gateSecret }
 */
export type NodeIdentity = { nodeId: string; publicKey: string; privateKey: string; gateSecret: string };

let cached: NodeIdentity | null | undefined;

export function nodeIdentity(): NodeIdentity | null {
  if (cached !== undefined) return cached;
  const file = env().OPENSHELF_NODE_KEY_FILE;
  try {
    cached = file ? (JSON.parse(readFileSync(file, "utf8")) as NodeIdentity) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function panelConfigured(): boolean {
  const e = env();
  return Boolean(e.PANEL_URL && e.PANEL_PUBLIC_KEY && nodeIdentity());
}

export function signAsNode(data: string): string {
  const id = nodeIdentity();
  if (!id) throw new Error("No node identity");
  const key = createPrivateKey({ key: Buffer.from(id.privateKey, "base64"), format: "der", type: "pkcs8" });
  return sign(null, Buffer.from(data), key).toString("base64url");
}

/** Verifies a token signed by the panel: `<base64url(json)>.<base64url(ed25519 sig)>`. */
export function verifyPanelToken(token: string): { sub: string; aud: string; exp: number; nonce: string } | null {
  const pub = env().PANEL_PUBLIC_KEY;
  const [body, sig] = token.split(".");
  if (!pub || !body || !sig) return null;
  try {
    const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: pub }, format: "jwk" });
    if (!verify(null, Buffer.from(body), key, Buffer.from(sig, "base64url"))) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- tunnel gate

/** Cookie proving the visitor came in through a panel token (checked by src/proxy.ts). */
export const GATE_COOKIE = "sa_gate";

export function gateCookieValue(expMs: number): string | null {
  const secret = env().OPENSHELF_GATE_SECRET;
  if (!secret) return null;
  const sig = createHmac("sha256", secret).update(`gate:${expMs}`).digest("base64url");
  return `${expMs}.${sig}`;
}

export function gateCookieValid(value: string | undefined, secret: string | undefined): boolean {
  if (!value || !secret) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`gate:${exp}`).digest("base64url"));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
