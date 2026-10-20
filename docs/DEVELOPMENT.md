# Developer guide

This guide covers the stack, configuration, architecture and tooling. To just install and use OpenShelf, see the [README](../README.md).

## Stack

| Concern    | Choice |
| ---------- | ------ |
| App        | Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript |
| Styling    | Tailwind CSS v4 |
| Database   | PostgreSQL via Drizzle ORM. Local dev falls back to embedded Postgres ([PGlite](https://pglite.dev)), so no Docker is needed |
| Auth       | Custom session auth: bcrypt passwords, opaque session tokens (stored only as SHA-256 hashes), HTTP-only cookies |
| Storage    | `StorageDriver` interface with a local-disk driver (swap in S3/R2 without touching callers) |
| Validation | zod |
| Tests      | Vitest (unit) |

## Quick start (local)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. A fresh database sends you to **`/setup`**, where you create the server's **admin**
(owner) account and name the server. `/setup` only works once, and only from `localhost`. The local database and
uploads live in `./.data/` (git-ignored). Migrations are applied automatically.

Optionally, configure the platform **super admin** too: run `npm run admin:hash`, then put `SUPER_ADMIN_EMAIL`
and the printed `SUPER_ADMIN_PASSWORD_HASH_B64` into `.env.local`.

## Servers, invites and Wi-Fi sharing

- Each install is one **server** (`server_settings`, a single row created by `/setup`) with a **join mode**:
  `invite` (the default; an invite link is required), `approval` (sign-ups become `pending` until the admin
  approves them at `/admin/requests`) or `open`.
- **Invite links** (`/join/<token>`) store only a SHA-256 of the token. They can expire and have a use limit. A
  seat is used inside the sign-up transaction, so a single-use link can't be shared.
- **Share on my Wi-Fi** writes `data/network.json`. The installed app's supervisor (`openshelf.mjs start`) watches
  that file and restarts the server bound to `0.0.0.0` (or back to `127.0.0.1`). Invite pages list Wi-Fi
  addresses first.
- Over plain `http` (localhost or a LAN address), the session cookie is an ordinary `HttpOnly` cookie. Over HTTPS,
  it's a `__Host-` `Secure` cookie.

## Super admin

- There is exactly one super admin. It is defined by **`SUPER_ADMIN_EMAIL`** and **`SUPER_ADMIN_PASSWORD_HASH_B64`**.
  It is never created through sign-up.
- The password is **never stored in plaintext**, not even in env. You store a bcrypt hash, base64-encoded because
  bcrypt hashes contain `$`, which `.env` files would otherwise expand.
- On first admin sign-in a `users` row with `role = super_admin` and **no password hash** is created, so audit
  logs can reference it. A partial unique index guarantees there is at most one such row.
- Env is the source of truth. Change `SUPER_ADMIN_EMAIL` and the old admin's sessions stop working immediately.
  The old row is demoted and suspended the next time the new admin signs in. Leave both variables empty to
  disable admin sign-in completely.
- Admin sessions expire after `ADMIN_SESSION_TTL_HOURS` (default 12h). User sessions expire after
  `SESSION_TTL_DAYS` (default 7).
- Sign-up rejects the admin's email and staff-like usernames (`admin`, `root`, `moderator`, …).

## Super Admin panel (`panel/`)

A free Cloudflare Worker + D1 app that lists every admin server that's online and lets the Super Admin open
any of them. Setup for the owner is in [INSTALL.md](../INSTALL.md#3-set-up-the-super-admin-panel-platform-owner).

- **Linking.** `npm run panel:setup` writes `installer/panel.json` (panel URL + the panel's Ed25519 public key).
  The release bundle ships it, and the supervisor (`installer/app/openshelf.mjs start`) passes it to the app as
  `PANEL_URL` / `PANEL_PUBLIC_KEY`. Without that file, nothing below runs.
- **Node identity.** Each install creates an Ed25519 key pair once, kept with its data
  (`src/server/panel/node-identity.ts`). The panel pins the key on first contact (TOFU), so another machine
  can't impersonate a server.
- **Heartbeat.** Every minute, `src/server/panel/agent.ts` (started from `src/instrumentation.ts`) posts a signed
  summary: server name and version, members, content metadata (never file contents) and the current tunnel URL.
- **Remote access.** While a panel is configured, the supervisor keeps a Cloudflare quick tunnel
  (`cloudflared`, downloaded and SHA-256-verified once) open to the local server. `src/proxy.ts` answers 404 on
  `*.trycloudflare.com` unless the request carries the `sa_gate` cookie, so the tunnel is useless to anyone
  else.
- **Sign-in.** **Open live server** in the panel issues a 5-minute, single-use token signed by the panel key and
  addressed to that node. `/api/sa/login` verifies it, signs in the Super Admin (`ensurePanelSuperAdmin`) and
  sets the gate cookie.
- **Panel auth.** One panel key, stored in Cloudflare only as a SHA-256 hash. Panel sessions are HMAC-signed
  cookies, and form posts are checked against the `Host` header.
- **Local development.** `cd panel && npx wrangler dev`, then start an app with `PANEL_URL=http://127.0.0.1:8787`
  and `PANEL_PUBLIC_KEY=<x of the dev signing key>`.

## Roles and permissions (RBAC)

Defined in [src/lib/rbac.ts](../src/lib/rbac.ts). Code checks **permissions**, never role names:

| Permission | user (member) | admin (server owner) | super_admin |
| ---------- | :--: | :--: | :---------: |
| `content:create`, `content:update:own`, `content:delete:own` | ✓ | ✓ | ✓ |
| `content:read:any`, `content:moderate:any`, `content:delete:any` | | ✓ | ✓ |
| `user:read:any`, `user:suspend`, `user:remove`, `user:approve` | | ✓ | ✓ |
| `audit:read`, `admin:dashboard` | | ✓ | ✓ |
| `server:manage`, `invite:manage` | | ✓ | ✓ |

Ranks are `user` < `admin` < `super_admin`. Account actions require outranking the target (`outranks`), so the
admin can manage members but can never suspend or remove the super admin, or themselves.

There is deliberately no `content:update:any`. Moderators remove or restore content, but they never edit
someone else's words.

**Adding a role** (for example `moderator`):

1. Add it to `ROLES` and `ROLE_PERMISSIONS` in `src/lib/rbac.ts`.
2. Add it to the `user_role` enum in `src/server/db/schema.ts`.
3. Run `npm run db:generate` and commit the migration.

Call sites don't change.

## Transparency model

- The admin-powers disclosure lives in **one place**, [src/lib/legal.ts](../src/lib/legal.ts). The
  [Terms](../src/app/terms/page.tsx) (`/terms#admin-powers`), the [Privacy Policy](../src/app/privacy/page.tsx)
  (`/privacy#admin-access`), and the notice shown next to the sign-up checkbox all render from it.
- Sign-up requires ticking the acceptance checkbox, and the server enforces this too. Every acceptance is
  recorded in `tos_acceptances` (version, time, IP, user agent).
- **Consent is collected exactly once, at sign-up.** Users are never asked to accept again. `TOS_VERSION` in
  `src/lib/legal.ts` is stored with each acceptance, so you can tell which text a user agreed to.
- The admin needs no per-action permission. Admin actions are still **audit-logged**, including each time the
  admin opens content that is not public. The admin sees a notice saying so on those pages.

## Project structure

```
src/
  app/                    routes (pages, server actions, route handlers)
    (auth)/               signup, login
    actions/              server actions (thin: authorize -> call service -> revalidate)
    admin/                super admin: overview, users, content, activity log
    api/content           upload endpoint (multipart)
    api/files/[id]        access-checked file serving
    c/[id]                content page (+ /edit)
    u/[username]          public profile
    terms, privacy        legal pages
  components/             UI components
  lib/                    pure, client-safe modules: rbac, validation, legal text, env, file types
  server/                 server-only code
    auth/                 password hashing, sessions, current-user Data Access Layer
    db/                   Drizzle schema + client
    services/             business logic (auth, content, users/admin)
    storage/              storage driver
    panel/                link to the Super Admin panel (node identity, heartbeat agent)
    audit.ts              audit log writer
drizzle/                  SQL migrations
installer/                Windows installer (OpenShelf.exe) and the supervisor (app/openshelf.mjs)
panel/                    Super Admin panel: Cloudflare Worker + D1
scripts/                  admin:hash, db:migrate, panel:setup, release bundle
```

## Database schema

- **users**: email and username (case-insensitively unique), display name, password hash (null for the super
  admin), `role`, `status` (active/suspended/deleted), status reason, accepted ToS version and time.
- **sessions**: SHA-256 of the session token, user, expiry, IP, user agent.
- **tos_acceptances**: consent history (user, version, time, IP, user agent).
- **content**: owner, title, description, `visibility` (public/unlisted/private), `status`
  (published/draft/removed), storage key, file metadata, moderation fields (reason, by, at, status before removal).
- **audit_logs**: actor and actor role, action, target, JSON metadata, IP, time.

## Security

See [SECURITY.md](../SECURITY.md) for the full checklist (CSP, rate limits, bot protection, upload checks, and more) and how to report a vulnerability.

Optional environment variables:

- `FORCE_HTTPS=true`: redirects HTTP to HTTPS and sends HSTS. Use it behind a TLS proxy.
- `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`: turn on the Cloudflare Turnstile CAPTCHA on sign-up.
- `FORM_TOKEN_SECRET`: a stable secret for the sign-up bot-check token. Set it when you run several instances.

## Account self-service

`/settings` lets users change their display name and password (which signs out every other session), and
**delete their account**. Deletion requires the password and typing `DELETE`. It erases all of the user's
content and files and scrubs email, username, display name, and password hash. The email and username become
free again. An anonymized tombstone row is kept so audit-log references stay valid. The super admin's
settings page explains that its credentials live in env config.

## Docker

```bash
cp .env.example .env     # set SUPER_ADMIN_*, POSTGRES_PASSWORD, PLATFORM_*
docker compose up -d --build
```

This starts Postgres 17, then a one-shot `migrate` service, then the app on port 3000. The app runs as a
non-root user with uploads on the `uploads` volume. Put a TLS-terminating reverse proxy in front of it.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Dev server (auto-migrates the local PGlite database) |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (RBAC, validation, upload allowlist) |
| `npm run test:e2e` | End-to-end smoke test against a running server with a **fresh** database (set `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:generate` | Generate a migration after changing `schema.ts` |
| `npm run db:migrate` | Apply migrations (`DATABASE_URL`, or local PGlite) |
| `npm run admin:hash` | Produce `SUPER_ADMIN_PASSWORD_HASH_B64` |
| `npm run panel:setup` | Create or redeploy the Super Admin panel on Cloudflare (`npm run panel:rotate-key` for new keys + signing key) |
| `npm run panel:new-key` | New panel sign-in key only; servers stay linked |

## Production checklist

1. Provision PostgreSQL and set `DATABASE_URL`. Without it, production refuses to start unless `EMBEDDED_DB=true`, which is meant for single-PC installs such as the Windows installer and the setup script.
2. Run `npm run db:migrate` as a deploy step.
3. Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD_HASH_B64` in your host's secret manager.
4. Uploads: the local-disk driver needs a persistent volume. For serverless or multiple instances, implement
   `StorageDriver` for S3/R2.
5. Serve over HTTPS behind a proxy that sets `X-Forwarded-For`. The session cookie becomes `__Host-session`
   with `Secure` in production.
6. With more than one instance, move the in-memory rate limiter (`src/server/rate-limit.ts`) to Redis.
7. Get the Terms and Privacy text in `src/lib/legal.ts` and `src/app/{terms,privacy}` reviewed for your
   jurisdiction (for example GDPR or India's DPDP Act), and set `PLATFORM_CONTACT_EMAIL`.
