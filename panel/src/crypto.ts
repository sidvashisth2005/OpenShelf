// Small WebCrypto helpers shared by the panel. Everything here is cheap (no slow
// password hashing), so it stays well inside the Workers free-plan CPU limit.

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison (same length assumed for hashes). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function hmacSign(secret: string, data: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data)));
}

export async function hmacVerify(secret: string, data: string, sig: string): Promise<boolean> {
  try {
    return await crypto.subtle.verify("HMAC", await hmacKey(secret), fromB64url(sig), enc.encode(data));
  } catch {
    return false;
  }
}

/** Verifies an Ed25519 signature from an admin server (raw 32-byte public key, base64url). */
export async function verifyNodeSignature(publicKeyB64: string, data: string, sigB64: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", fromB64url(publicKeyB64), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, fromB64url(sigB64), enc.encode(data));
  } catch {
    return false;
  }
}

/** Signs a short-lived super admin token that admin servers verify with the panel's public key. */
export async function signPanelToken(privateJwk: string, payload: Record<string, unknown>): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", JSON.parse(privateJwk), { name: "Ed25519" }, false, ["sign"]);
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("Ed25519", key, enc.encode(body));
  return `${body}.${b64url(sig)}`;
}
