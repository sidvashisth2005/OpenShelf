# Security

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub's
[security advisories](https://github.com/sidvashisth2005/OpenShelf/security/advisories/new). We'll respond as
soon as we can.

## Security checklist

How OpenShelf handles common web-app risks, and where each control lives.

| # | Control | Status | Where / how |
|---|---------|--------|-------------|
| 1 | Users can only reach their own data | ✅ | All data access goes through the server-side Data Access Layer (`src/server/auth/current-user.ts`) and services that check ownership and visibility (`can`, `canView` in `src/lib/rbac.ts`). The browser never talks to the database. *Postgres row-level security is not used:* the app connects with a single DB role and enforces access in one audited code path. |
| 2 | Auth check on every endpoint | ✅ | Every Server Action and Route Handler calls `assertPermission` / `getCurrentUser`. Public endpoints (`/api/health`, public files) return only public data. |
| 3 | Never trust the client | ✅ | Role, user ID and ownership always come from the server session. Sign-up input has no `role` field (unit-tested). No prices or payments exist. |
| 4 | Rate limiting | ✅ | `src/proxy.ts`: 600 requests/min per IP and 60 writes/min per IP. Sign-in is limited to 30 per IP and 8 per email every 15 minutes, sign-up to 10 per IP per hour, uploads to 30 per user per hour. The limiter is in memory; use Redis when you run several instances. |
| 5 | Input sanitising / XSS | ✅ | zod validation on every input. React escapes all output, and the code never uses `dangerouslySetInnerHTML`. Uploaded files are served with `nosniff` and a sandbox CSP. SVG and HTML uploads are refused. |
| 6 | Parameterized queries | ✅ | Drizzle ORM. `sql` template values are bound parameters, never `sql.raw`. LIKE wildcards are escaped (`escapeLike`). |
| 7 | CORS locked down | ✅ | No CORS headers are sent, so browsers block cross-origin reads. Server Actions verify `Origin` (built into Next.js). The upload API rejects any request whose `Origin` isn't this site. Cookies are `SameSite=Lax`. |
| 8 | HTTPS | ✅ (deployments) | Set `FORCE_HTTPS=true` behind a TLS proxy: HTTP requests get a 308 redirect, and the app sends HSTS and `upgrade-insecure-requests`. HTTPS sessions use a `__Host-` + `Secure` cookie. The installed app listens on `127.0.0.1` only, unless the admin turns on **Share on my Wi-Fi**. Then it is reachable on the local network over plain `http`, so traffic between devices on that Wi-Fi is **not encrypted**. Use it on trusted home or team networks, not public Wi-Fi. |
| 9 | IDOR | ✅ | Content IDs are random UUIDs, and every lookup re-checks owner/visibility. Changing an ID in the URL returns 404 (end-to-end tested). |
| 10 | No debug output in production | ✅ | Production builds hide stack traces. API errors are generic. `X-Powered-By` is removed. |
| 11 | CAPTCHA / bot protection | ✅ | Sign-up has a honeypot field and an HMAC-signed minimum-fill-time token (both work offline), plus **Cloudflare Turnstile** when `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` are set. There is no contact form. |
| 12 | Admin action log | ✅ | Every admin action is recorded in `audit_logs` (who, what, target, reason, IP, time), including each time the admin opens non-public content. |
| 13 | Private storage | ✅ | Files live outside the web root and are served only through `/api/files/[id]`, which checks the session and visibility on every request. Non-public files are sent with `Cache-Control: private, no-store`. This is stronger than signed URLs, because access is re-checked on every request. |
| 14 | Admin pages protected server-side | ✅ | Each admin page and action checks permissions on the server and returns 404 to non-admins. |
| 15 | Vulnerable packages | ✅ prod / ⚠️ dev | `npm audit --omit=dev` reports **0**. One dev-only advisory (`braces`, used inside ESLint tooling) has no patched version yet. It is never shipped and is not reachable at runtime. |
| 16 | Upload type checks | ✅ | MIME + extension allowlist, size limit (checked before the body is buffered), and a **magic-byte check** of the file's real contents, so a renamed `.exe` is rejected. |
| 17 | Security review | ✅ | Reviewed against this list. Unit and end-to-end suites cover the controls (`npm test`, `npm run test:e2e`). |
| 18 | Security headers | ✅ | Per-request **nonce CSP** (`script-src 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, and HSTS on HTTPS. |
| 19 | Webhook signatures | N/A | OpenShelf receives no webhooks and has no payments. If you add them, verify the provider's signature (for example Stripe's `constructEvent`) before trusting the body. |

## Passwords and sessions

- Passwords are hashed with bcrypt (cost 12). Failed sign-ins take the same time whether or not the account
  exists.
- Session tokens are 256-bit random values. Only their SHA-256 hash is stored, in HTTP-only cookies.
- Super admin sessions expire after 12 hours. Changing a password signs out every other session.
