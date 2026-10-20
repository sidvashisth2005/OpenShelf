# OpenShelf

An open-source content platform. Anyone can create an account and upload, publish, and manage content. A single
config-defined **Super Admin** moderates the platform. Its powers are disclosed up front in the Terms of Service
and Privacy Policy, and users consent to them once, at sign-up.

## Install

There are two ways to install OpenShelf on a PC.

### Option 1: OpenShelf.exe (Windows, easiest)

Download **`OpenShelf.exe`** from the [latest release](https://github.com/sidvashisth2005/OpenShelf/releases/latest)
and run it. It takes a few minutes:

1. It downloads Node.js and the app (about 60 MB) and verifies both against SHA-256 checksums.
2. It installs them for your user under `%LOCALAPPDATA%\OpenShelf`. No admin rights are needed.
3. It asks for an admin email and password. Only a bcrypt hash of the password is stored.
4. It runs a self-test.
5. It adds Desktop and Start Menu shortcuts and an uninstaller in *Apps & features*.
6. It opens OpenShelf in your browser.

OpenShelf only listens on `127.0.0.1`, so it can be reached from this PC only. Running the installer again
updates an existing install and keeps your data. Windows SmartScreen may warn because the exe is not
code-signed yet: choose *More info → Run anyway*.

### Option 2: clone and run the setup script

Needs [Node.js 20.9+](https://nodejs.org) (Windows: `winget install OpenJS.NodeJS.LTS`).

```bash
git clone https://github.com/sidvashisth2005/OpenShelf.git
cd OpenShelf
setup.cmd        # Windows   (macOS/Linux: ./setup.sh)
npm start        # then open http://localhost:3000
```

The setup script installs dependencies, writes `.env.local` (it asks for the admin email and password and stores
only a hash), prepares the embedded database, runs typecheck, lint and unit tests, and builds the app.

### Updates

The installed app checks GitHub Releases each time it opens. It shows a popup only for releases the
maintainers mark as notable. See [RELEASING.md](RELEASING.md).

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
npm run admin:hash          # prompts for the super admin password, prints SUPER_ADMIN_PASSWORD_HASH_B64=...
# put SUPER_ADMIN_EMAIL and the printed SUPER_ADMIN_PASSWORD_HASH_B64 into .env.local
npm run dev
```

Open http://localhost:3000. The local database and uploads live in `./.data/` (git-ignored). Migrations are
applied to it automatically.

Sign in at `/login` with `SUPER_ADMIN_EMAIL` and the password you hashed. The super admin lands on `/admin`.

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

## Roles and permissions (RBAC)

Defined in [src/lib/rbac.ts](src/lib/rbac.ts). Code checks **permissions**, never role names:

| Permission | user | super_admin |
| ---------- | :--: | :---------: |
| `content:create`, `content:update:own`, `content:delete:own` | ✓ | ✓ |
| `content:read:any`, `content:moderate:any`, `content:delete:any` | | ✓ |
| `user:read:any`, `user:suspend`, `user:remove` | | ✓ |
| `audit:read`, `admin:dashboard` | | ✓ |

There is deliberately no `content:update:any`. Moderators remove or restore content, but they never edit
someone else's words.

**Adding a role** (for example `moderator`):

1. Add it to `ROLES` and `ROLE_PERMISSIONS` in `src/lib/rbac.ts`.
2. Add it to the `user_role` enum in `src/server/db/schema.ts`.
3. Run `npm run db:generate` and commit the migration.

Call sites don't change.

## Transparency model

- The admin-powers disclosure lives in **one place**, [src/lib/legal.ts](src/lib/legal.ts). The
  [Terms](src/app/terms/page.tsx) (`/terms#admin-powers`), the [Privacy Policy](src/app/privacy/page.tsx)
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
    audit.ts              audit log writer
drizzle/                  SQL migrations
scripts/                  admin:hash, db:migrate
```

## Database schema

- **users**: email and username (case-insensitively unique), display name, password hash (null for the super
  admin), `role`, `status` (active/suspended/deleted), status reason, accepted ToS version and time.
- **sessions**: SHA-256 of the session token, user, expiry, IP, user agent.
- **tos_acceptances**: consent history (user, version, time, IP, user agent).
- **content**: owner, title, description, `visibility` (public/unlisted/private), `status`
  (published/draft/removed), storage key, file metadata, moderation fields (reason, by, at, status before removal).
- **audit_logs**: actor and actor role, action, target, JSON metadata, IP, time.

## Security notes

- Uploads use an allowlist: images, MP4/WebM, audio, PDF, text/Markdown. SVG and HTML are refused, and the
  extension must match the declared type.
- Files are served with `nosniff` and a sandboxing CSP, and non-public files with `Cache-Control: no-store`.
- Sign-in and sign-up are rate limited. Failed sign-ins take the same time whether or not the account exists.
- Admin pages return **404** to non-admins, so they aren't discoverable.
- Every server action and route handler re-checks authorization through the Data Access Layer
  (`src/server/auth/current-user.ts`). Pages never rely on layouts alone for this.

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
| `npm run test:e2e` | 66-check end-to-end smoke test against a running server with a **fresh** database (set `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:generate` | Generate a migration after changing `schema.ts` |
| `npm run db:migrate` | Apply migrations (`DATABASE_URL`, or local PGlite) |
| `npm run admin:hash` | Produce `SUPER_ADMIN_PASSWORD_HASH_B64` |

## Production checklist

1. Provision PostgreSQL and set `DATABASE_URL`. The app refuses to use embedded PGlite in production.
2. Run `npm run db:migrate` as a deploy step.
3. Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD_HASH_B64` in your host's secret manager.
4. Uploads: the local-disk driver needs a persistent volume. For serverless or multiple instances, implement
   `StorageDriver` for S3/R2.
5. Serve over HTTPS behind a proxy that sets `X-Forwarded-For`. The session cookie becomes `__Host-session`
   with `Secure` in production.
6. With more than one instance, move the in-memory rate limiter (`src/server/rate-limit.ts`) to Redis.
7. Get the Terms and Privacy text in `src/lib/legal.ts` and `src/app/{terms,privacy}` reviewed for your
   jurisdiction (for example GDPR or India's DPDP Act), and set `PLATFORM_CONTACT_EMAIL`.
