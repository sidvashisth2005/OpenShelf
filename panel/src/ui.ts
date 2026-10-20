// Server-rendered HTML for the panel. Every dynamic value goes through esc().

export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

const CSS = `
:root{--bg:#f7f7f9;--surface:#fff;--fg:#18181b;--muted:#71717a;--border:#e4e4e7;--accent:#6d28d9;--accent-soft:#ede9fe;--ok:#059669;--bad:#dc2626}
@media (prefers-color-scheme:dark){:root{--bg:#09090b;--surface:#131316;--fg:#f4f4f5;--muted:#a1a1aa;--border:#27272a;--accent:#a78bfa;--accent-soft:#2e1065;--ok:#34d399;--bad:#f87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header{display:flex;align-items:center;gap:12px;padding:14px 24px;border-bottom:1px solid var(--border);background:var(--surface)}
.logo{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#db2777)}
main{max-width:1100px;margin:0 auto;padding:28px 20px}
h1{font-size:24px;margin:0 0 4px}.muted{color:var(--muted)}.small{font-size:13px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-top:18px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.stat{font-size:26px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:9px 10px;border-top:1px solid var(--border)}th{color:var(--muted);font-weight:500;font-size:12px;text-transform:uppercase;border-top:0}
.btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:10px;padding:8px 14px;font:inherit;font-weight:500;cursor:pointer}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn.danger{color:var(--bad)}
.badge{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:600}
.on{background:rgba(5,150,105,.12);color:var(--ok)}.off{background:rgba(113,113,122,.15);color:var(--muted)}
input{width:100%;border:1px solid var(--border);background:var(--surface);color:var(--fg);border-radius:10px;padding:10px 12px;font:inherit}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.right{margin-left:auto}
.notice{background:var(--accent-soft);border-radius:12px;padding:12px 14px;font-size:14px}
`;

export function page(title: string, body: string, signedIn = false): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · OpenShelf Super Admin</title><style>${CSS}</style></head><body>
<header><span class="logo"></span><b>OpenShelf</b><span class="muted">Super Admin panel</span>
${signedIn ? `<form method="post" action="/logout" class="right"><button class="btn">Sign out</button></form>` : ""}</header>
<main>${body}</main></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https:; frame-ancestors 'none'; base-uri 'none'",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
    },
  });
}
