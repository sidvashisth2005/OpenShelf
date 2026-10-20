import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { audit } from "@/server/audit";
import { createSession } from "@/server/auth/session";
import { GATE_COOKIE, gateCookieValue, nodeIdentity, panelConfigured, verifyPanelToken } from "@/server/panel/node-identity";
import { ensurePanelSuperAdmin } from "@/server/panel/super-admin";

/** Nonces of tokens already used (tokens live 5 minutes, so an in-memory set is enough). */
const used = new Map<string, number>();

/**
 * Entry point for the Super Admin coming from the panel: GET /api/sa/login?token=…
 * The token is signed by the panel's Ed25519 key, addressed to this server,
 * short-lived and single-use.
 */
export async function GET(request: Request) {
  const notFound = () => new NextResponse("Not found", { status: 404 });
  if (!panelConfigured()) return notFound();
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const claims = verifyPanelToken(token);
  const me = nodeIdentity();
  const now = Date.now();
  for (const [n, exp] of used) if (exp < now) used.delete(n);
  if (!claims || !me || claims.sub !== "super_admin" || claims.aud !== me.nodeId || !(claims.exp > now) || used.has(claims.nonce)) {
    return notFound();
  }
  used.set(claims.nonce, claims.exp);

  const admin = await ensurePanelSuperAdmin();
  await createSession(admin);
  await audit({ actor: admin, action: "auth.login", targetType: "user", targetId: admin.id, metadata: { via: "super admin panel" } });

  // Lets this browser through the tunnel gate (src/proxy.ts) for the length of an admin session.
  const exp = now + 12 * 3_600_000;
  const gate = gateCookieValue(exp);
  if (gate) {
    (await cookies()).set(GATE_COOKIE, gate, { httpOnly: true, secure: true, sameSite: "lax", path: "/", expires: new Date(exp) });
  }
  // Relative on purpose: behind the tunnel, request.url carries the local port, not the public host.
  return new Response(null, { status: 303, headers: { location: "/admin" } });
}
