/**
 * OpenShelf Super Admin panel (Cloudflare Worker + D1, free plan).
 *
 * - Admin servers POST signed heartbeats (/api/heartbeat): who they are, their
 *   current tunnel URL while online, and a snapshot of members and content.
 * - The super admin signs in with a long random panel key, sees every server and
 *   its last snapshot, and opens a live server through a short-lived Ed25519
 *   token that the server verifies with the panel's public key.
 *
 * Secrets (wrangler secret put): PANEL_KEY_HASH, SESSION_SECRET, SIGNING_JWK.
 */
import { b64url, hmacSign, hmacVerify, safeEqual, sha256Hex, signPanelToken, verifyNodeSignature } from "./crypto";
import { ago, esc, formatBytes, page } from "./ui";

export interface Env {
  DB: D1Database;
  PANEL_KEY_HASH: string; // sha256 hex of the super admin's panel key
  SESSION_SECRET: string; // HMAC secret for the panel session cookie
  SIGNING_JWK: string; // Ed25519 private key (JWK) used to sign server login tokens
}

type Snapshot = {
  serverName?: string;
  stats?: { members?: number; content?: number; storageBytes?: number; pending?: number };
  members?: { username: string; displayName: string; email: string; role: string; status: string; lastLoginAt?: string | null }[];
  content?: { id: string; title: string; owner: string; visibility: string; status: string; mimeType: string; sizeBytes: number; createdAt: string }[];
};

type NodeRow = {
  id: string;
  public_key: string;
  name: string;
  version: string;
  tunnel_url: string | null;
  snapshot: string;
  last_seen: number;
  created_at: number;
};

const ONLINE_MS = 3 * 60_000;
const SESSION_HOURS = 8;
const COOKIE = "panel_session";
const isOnline = (n: NodeRow) => Boolean(n.tunnel_url) && Date.now() - n.last_seen < ONLINE_MS;

// ------------------------------------------------------------------ session

async function readSession(req: Request, env: Env): Promise<boolean> {
  const raw = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return hmacVerify(env.SESSION_SECRET, `session:${exp}`, sig);
}

async function sessionCookie(env: Env): Promise<string> {
  const exp = String(Date.now() + SESSION_HOURS * 3_600_000);
  const sig = await hmacSign(env.SESSION_SECRET, `session:${exp}`);
  return `${COOKIE}=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
}

const redirect = (to: string, cookie?: string) =>
  new Response(null, { status: 303, headers: { location: to, ...(cookie ? { "set-cookie": cookie } : {}) } });

/** Rejects cross-site form posts (the session cookie is SameSite=Strict too). */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("host") ?? new URL(req.url).host);
  } catch {
    return false;
  }
}

async function audit(env: Env, req: Request, action: string, nodeId?: string) {
  await env.DB.prepare("INSERT INTO audit (at, action, node_id, ip) VALUES (?, ?, ?, ?)")
    .bind(Date.now(), action, nodeId ?? null, req.headers.get("cf-connecting-ip"))
    .run();
}

// ------------------------------------------------------------------ pages

function loginPage(error?: string): Response {
  return page(
    "Sign in",
    `<div class="card" style="max-width:440px;margin:60px auto">
      <h1>Super Admin</h1><p class="muted">Paste your panel key to sign in.</p>
      ${error ? `<p class="notice" style="color:var(--bad)">${esc(error)}</p>` : ""}
      <form method="post" action="/login"><input name="key" type="password" autocomplete="current-password" required autofocus>
      <p><button class="btn primary">Sign in</button></p></form></div>`,
  );
}

async function nodesPage(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare("SELECT * FROM nodes ORDER BY last_seen DESC").all<NodeRow>();
  const online = results.filter(isOnline).length;
  const cards = results
    .map((n) => {
      const s: Snapshot = JSON.parse(n.snapshot || "{}");
      return `<a class="card" style="display:block;margin:0;color:inherit" href="/node/${esc(n.id)}">
        <div class="row"><b>${esc(n.name || s.serverName || "Unnamed server")}</b>
        <span class="badge ${isOnline(n) ? "on" : "off"} right">${isOnline(n) ? "Online" : "Offline"}</span></div>
        <p class="muted small" style="margin:4px 0 12px">v${esc(n.version)} · seen ${ago(n.last_seen)}</p>
        <div class="row small"><span><b>${s.stats?.members ?? 0}</b> members</span><span><b>${s.stats?.content ?? 0}</b> files</span>
        <span>${formatBytes(s.stats?.storageBytes ?? 0)}</span>${s.stats?.pending ? `<span><b>${s.stats.pending}</b> waiting</span>` : ""}</div></a>`;
    })
    .join("");
  return page(
    "Servers",
    `<h1>Admin servers</h1><p class="muted">${results.length} server(s), ${online} online now. Online servers can be opened live; offline ones show their last report.</p>
     <div class="grid" style="margin-top:18px">${cards || `<div class="card muted">No admin servers have reported yet.</div>`}</div>`,
    true,
  );
}

async function nodePage(env: Env, id: string): Promise<Response> {
  const n = await env.DB.prepare("SELECT * FROM nodes WHERE id = ?").bind(id).first<NodeRow>();
  if (!n) return page("Not found", `<p>Server not found. <a href="/">Back</a></p>`, true);
  const s: Snapshot = JSON.parse(n.snapshot || "{}");
  const members = (s.members ?? [])
    .map((m) => `<tr><td><b>${esc(m.displayName)}</b> <span class="muted">@${esc(m.username)}</span></td><td>${esc(m.email)}</td><td>${esc(m.role)}</td><td>${esc(m.status)}</td></tr>`)
    .join("");
  const files = (s.content ?? [])
    .map((c) => `<tr><td>${esc(c.title)}</td><td>@${esc(c.owner)}</td><td>${esc(c.visibility)} · ${esc(c.status)}</td><td>${esc(c.mimeType)}</td><td>${formatBytes(c.sizeBytes)}</td></tr>`)
    .join("");
  return page(
    n.name || "Server",
    `<p><a href="/">← All servers</a></p>
     <div class="row"><h1>${esc(n.name || s.serverName || "Unnamed server")}</h1>
     <span class="badge ${isOnline(n) ? "on" : "off"}">${isOnline(n) ? "Online" : "Offline"}</span></div>
     <p class="muted">v${esc(n.version)} · last report ${ago(n.last_seen)} · id ${esc(n.id)}</p>
     <div class="card row">
       ${isOnline(n)
         ? `<form method="post" action="/node/${esc(n.id)}/open"><button class="btn primary">Open live server as Super Admin →</button></form>
            <span class="muted small">Opens this server's admin panel over the internet. Files load from the admin's PC.</span>`
         : `<span class="muted">This server is offline. You can see its last report below; files open when the admin's PC is online.</span>`}
       <form method="post" action="/node/${esc(n.id)}/delete" class="right" onsubmit="return confirm('Remove this server from the panel?')"><button class="btn danger">Remove</button></form>
     </div>
     <div class="card"><h2 style="margin-top:0">Members (${s.members?.length ?? 0})</h2>
       <table><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>${members || `<tr><td colspan="4" class="muted">None</td></tr>`}</table></div>
     <div class="card"><h2 style="margin-top:0">Files (${s.content?.length ?? 0})</h2>
       <table><tr><th>Title</th><th>Owner</th><th>Visibility</th><th>Type</th><th>Size</th></tr>${files || `<tr><td colspan="5" class="muted">None</td></tr>`}</table></div>`,
    true,
  );
}

// ------------------------------------------------------------------ heartbeat

async function heartbeat(req: Request, env: Env): Promise<Response> {
  const body = await req.text();
  if (body.length > 1_000_000) return new Response("Too large", { status: 413 });
  const sig = req.headers.get("x-openshelf-signature") ?? "";
  let msg: { nodeId?: string; publicKey?: string; name?: string; version?: string; tunnelUrl?: string | null; snapshot?: Snapshot; ts?: number };
  try {
    msg = JSON.parse(body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const { nodeId, publicKey, ts } = msg;
  if (!nodeId || !/^[A-Za-z0-9_-]{16,64}$/.test(nodeId) || !publicKey || typeof ts !== "number") return new Response("Bad request", { status: 400 });
  if (Math.abs(Date.now() - ts) > 5 * 60_000) return new Response("Clock skew", { status: 400 });
  if (!(await verifyNodeSignature(publicKey, body, sig))) return new Response("Bad signature", { status: 401 });

  const existing = await env.DB.prepare("SELECT public_key FROM nodes WHERE id = ?").bind(nodeId).first<{ public_key: string }>();
  // The first key a server reports with is pinned: nobody else can report as that server.
  if (existing && existing.public_key !== publicKey) return new Response("Key mismatch", { status: 403 });
  const tunnel = typeof msg.tunnelUrl === "string" && /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(msg.tunnelUrl) ? msg.tunnelUrl : null;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO nodes (id, public_key, name, version, tunnel_url, snapshot, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, version = excluded.version, tunnel_url = excluded.tunnel_url,
       snapshot = excluded.snapshot, last_seen = excluded.last_seen`,
  )
    .bind(nodeId, publicKey, String(msg.name ?? "").slice(0, 80), String(msg.version ?? "").slice(0, 20), tunnel, JSON.stringify(msg.snapshot ?? {}), now, now)
    .run();
  return Response.json({ ok: true });
}

// ------------------------------------------------------------------ router

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/api/heartbeat" && req.method === "POST") return heartbeat(req, env);

    if (path === "/login" && req.method === "POST") {
      if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
      const key = String((await req.formData()).get("key") ?? "");
      if (!key || !safeEqual(await sha256Hex(key), env.PANEL_KEY_HASH)) {
        await audit(env, req, "login_failed");
        return loginPage("That key is not right.");
      }
      await audit(env, req, "login");
      return redirect("/", await sessionCookie(env));
    }

    const signedIn = await readSession(req, env);
    if (!signedIn) return loginPage();

    if (req.method === "POST" && !sameOrigin(req)) return new Response("Forbidden", { status: 403 });
    if (path === "/logout" && req.method === "POST") return redirect("/", `${COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict`);
    if (path === "/" && req.method === "GET") return nodesPage(env);

    const m = path.match(/^\/node\/([A-Za-z0-9_-]{16,64})(\/open|\/delete)?$/);
    if (m) {
      const [, id, action] = m;
      if (!action && req.method === "GET") return nodePage(env, id);
      if (action === "/delete" && req.method === "POST") {
        await env.DB.prepare("DELETE FROM nodes WHERE id = ?").bind(id).run();
        await audit(env, req, "node_removed", id);
        return redirect("/");
      }
      if (action === "/open" && req.method === "POST") {
        const n = await env.DB.prepare("SELECT * FROM nodes WHERE id = ?").bind(id).first<NodeRow>();
        if (!n || !isOnline(n)) return redirect(`/node/${id}`);
        const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
        const token = await signPanelToken(env.SIGNING_JWK, { sub: "super_admin", aud: id, exp: Date.now() + 5 * 60_000, nonce });
        await audit(env, req, "node_opened", id);
        return redirect(`${n.tunnel_url}/api/sa/login?token=${encodeURIComponent(token)}`);
      }
    }
    return page("Not found", `<p>Not found. <a href="/">Back</a></p>`, true);
  },
} satisfies ExportedHandler<Env>;
