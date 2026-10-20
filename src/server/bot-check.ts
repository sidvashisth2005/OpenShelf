import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Bot protection for public forms (sign-up), in three layers:
 *  1. honeypot field humans never see (bots fill every input)
 *  2. a signed "form issued at" token: submissions faster than a human could type are rejected
 *  3. Cloudflare Turnstile CAPTCHA, enabled when TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY are set
 * Layers 1 and 2 need no third party and work offline (local installs).
 */

export const HONEYPOT_FIELD = "website";
export const FORM_TOKEN_FIELD = "formToken";
const MIN_FILL_MS = 3_000;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Per-process secret unless one is configured; tokens then expire on restart, which is harmless.
const SECRET = process.env.FORM_TOKEN_SECRET || randomBytes(32).toString("hex");

const sign = (data: string) => createHmac("sha256", SECRET).update(data).digest("base64url");

export function issueFormToken(): string {
  const issued = Date.now().toString(36);
  return `${issued}.${sign(issued)}`;
}

function verifyFormToken(token: unknown): "ok" | "fast" | "invalid" {
  if (typeof token !== "string") return "invalid";
  const [issued, mac] = token.split(".");
  if (!issued || !mac) return "invalid";
  const expected = Buffer.from(sign(issued));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = Date.now() - Number.parseInt(issued, 36);
  if (!(age >= 0) || age > MAX_AGE_MS) return "invalid";
  return age < MIN_FILL_MS ? "fast" : "ok";
}

export function turnstileSiteKey(): string | undefined {
  return process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY ? process.env.TURNSTILE_SITE_KEY : undefined;
}

async function verifyTurnstile(token: unknown, ip: string | null): Promise<boolean> {
  if (typeof token !== "string" || !token) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/** Returns an error message for the form, or null when the submission looks human. */
export async function checkHuman(input: Record<string, unknown>, ip: string | null): Promise<string | null> {
  if (typeof input[HONEYPOT_FIELD] === "string" && input[HONEYPOT_FIELD] !== "") {
    return "Your submission was blocked. Please try again.";
  }
  const token = verifyFormToken(input[FORM_TOKEN_FIELD]);
  if (token === "invalid") return "This form expired. Reload the page and try again.";
  if (token === "fast") return "That was a little too fast. Please wait a moment and submit again.";
  if (turnstileSiteKey() && !(await verifyTurnstile(input["cf-turnstile-response"], ip))) {
    return "Please complete the CAPTCHA check.";
  }
  return null;
}
