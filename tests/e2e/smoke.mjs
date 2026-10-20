// End-to-end smoke test against a running server on a FRESH database (no browser,
// no JS): submits the real HTML forms (React progressive enhancement) and API routes.
//
//   E2E_BASE_URL=http://localhost:3000 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
//
// The server must be configured with the same super admin credentials.
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (matching the server config).");
  process.exit(2);
}
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

class Client {
  // Each client gets its own IP, like separate people (per-IP rate limits apply per person).
  constructor(name) { this.name = name; this.cookies = new Map(); this.ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`; }
  cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (!v || /expires=Thu, 01 Jan 1970/i.test(c) || /max-age=0/i.test(c)) this.cookies.delete(k); else this.cookies.set(k, v);
    }
  }
  async req(path, init = {}) {
    const res = await fetch(BASE + path, { ...init, redirect: "manual", headers: { origin: BASE, "x-forwarded-for": this.ip, ...(init.headers ?? {}), cookie: this.cookieHeader() } });
    this.store(res);
    return res;
  }
  async get(path, headers) { const r = await this.req(path, { headers }); return { status: r.status, location: r.headers.get("location"), headers: r.headers, text: await r.text() }; }

  /** Finds the form whose HTML contains `marker`, fills it, and submits like a no-JS browser. */
  async submit(path, marker, fields) {
    const page = await this.get(path);
    const forms = [...page.text.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/g)].map((m) => m[0]);
    const form = forms.find((f) => f.includes(marker));
    if (!form) throw new Error(`[${this.name}] no form containing "${marker}" on ${path} (status ${page.status})`);
    const fd = new FormData();
    for (const m of form.matchAll(/<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?/g)) {
      fd.append(m[1], (m[2] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
    }
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    // Forms with a bot-check token reject submissions faster than a human (3 s).
    if (form.includes('name="formToken"') && !this.fast) await new Promise((r) => setTimeout(r, 3100));
    const res = await this.req(path, { method: "POST", body: fd });
    return { status: res.status, location: res.headers.get("location") ?? res.headers.get("x-action-redirect"), text: await res.text() };
  }

  async upload(fields, file) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append("file", file.blob, file.name);
    const res = await this.req("/api/content", { method: "POST", body: fd });
    return { status: res.status, body: await res.json() };
  }
}

const anonPage = (p) => fetch(BASE + p, { redirect: "manual" });
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const signupFields = (u) => ({ email: `${u}@example.test`, username: u, displayName: u.toUpperCase(), password: "a-long-password-1" });

// ---- first run: whoever installed it creates the server and becomes its admin --
const owner = new Client("owner");
const first = await owner.get("/");
check(first.status === 307 && (first.location ?? "").endsWith("/setup"), "a fresh server sends visitors to /setup");
check(((await new Client("early").get("/signup")).location ?? "").endsWith("/setup"), "sign-up waits until the server is set up");
let r = await owner.submit("/setup", "serverName", {
  serverName: "Team Shelf",
  displayName: "Owner One",
  username: "owner1",
  email: "owner@example.test",
  password: "owner-password-1",
  acceptTerms: "on",
});
check(r.status === 303 && (r.location ?? "").includes("/admin"), `owner sets up the server and is signed in (${r.status} ${r.location})`);
check((await owner.get("/admin")).text.includes("Team Shelf"), "owner sees their server's admin dashboard");
check((await new Client("late").get("/setup")).status === 307, "setup cannot run a second time");

// ---- invite-only by default ------------------------------------------------
check((await new Client("outsider").get("/signup")).text.includes("invite-only"), "invite-only server shows no sign-up form without a link");
r = await owner.submit("/admin/invites", "maxUses", { note: "Team", maxUses: "1", expiresInDays: "7" });
const inviteToken = r.text.match(/\/join\/([A-Za-z0-9_-]{20,})/)?.[1];
check(Boolean(inviteToken), "owner creates an invite link");
const viaLink = await new Client("linkvisitor").get(`/join/${inviteToken}`);
check(viaLink.status === 307 && (viaLink.location ?? "").includes(`invite=${inviteToken}`), "/join link opens sign-up with the invite");
const member1 = new Client("member1");
r = await member1.submit(`/signup?invite=${inviteToken}`, "acceptTerms", { ...signupFields("member1"), acceptTerms: "on" });
check(r.status === 303 && (r.location ?? "").includes("joined=1"), "invited person joins, is signed in and lands on the feed");
const reuse = await new Client("reuse").get(`/signup?invite=${inviteToken}`);
check(reuse.text.includes("invite link isn"), "a single-use invite link cannot be used twice");

// ---- ask to join (approval) ----------------------------------------------------
r = await owner.submit("/admin/settings", "joinMode", { name: "Team Shelf", joinMode: "approval" });
check(r.text.includes("Settings saved"), "owner switches the server to ask-to-join");
const asker = new Client("asker");
r = await asker.submit("/signup", "acceptTerms", { ...signupFields("asker"), acceptTerms: "on" });
check(r.text.includes("Request sent") && !asker.cookies.size, "ask-to-join sends a request without signing in");
r = await asker.submit("/login", "password", { email: "asker@example.test", password: "a-long-password-1" });
check(r.text.includes("waiting for the admin"), "a pending member cannot sign in yet");
check((await owner.get("/admin/requests")).text.includes("asker@example.test"), "owner sees the join request");
r = await owner.submit("/admin/requests", "Approve", {});
r = await asker.submit("/login", "password", { email: "asker@example.test", password: "a-long-password-1" });
check(r.status === 303, "after approval the member can sign in");
check((await member1.get("/admin")).status === 404, "members cannot open the admin area");

// The rest of the suite exercises open sign-up.
r = await owner.submit("/admin/settings", "joinMode", { name: "Team Shelf", joinMode: "open" });
check(r.text.includes("Settings saved"), "owner opens the server to everyone");

// ---- signup -------------------------------------------------------------
const alice = new Client("alice");
r = await alice.submit("/signup", "acceptTerms", signupFields("alice"));
check(r.text.includes("You must accept the Terms"), "signup without accepting terms is rejected");
check(!alice.cookies.size, "no session after rejected signup");

r = await alice.submit("/signup", "acceptTerms", { ...signupFields("alice"), acceptTerms: "on" });
check(r.status === 303 && r.location?.includes("joined=1"), `signup with terms accepted lands on the feed (${r.status} ${r.location})`);
check([...alice.cookies.keys()].some((k) => k.endsWith("session")), "session cookie set after signup");

const signupPage = await new Client("anon").get("/signup");
check(signupPage.text.includes("administrator access") && signupPage.text.includes("including content you mark as private"), "signup page shows the admin-access disclosure");

r = await new Client("x").submit("/signup", "acceptTerms", { ...signupFields("rooty"), email: ADMIN_EMAIL, acceptTerms: "on" });
check(r.text.includes("can&#x27;t be used to register") || r.text.includes("can't be used to register"), "super admin email can't be used for signup");
r = await new Client("x").submit("/signup", "acceptTerms", { ...signupFields("admin"), acceptTerms: "on" });
check(r.text.includes("reserved"), "reserved username 'admin' rejected");
r = await new Client("x").submit("/signup", "acceptTerms", { ...signupFields("alice2"), email: "ALICE@example.test", acceptTerms: "on" });
check(r.text.includes("already exists"), "duplicate email (case-insensitive) rejected");

// ---- bot protection ------------------------------------------------------
const bot = new Client("bot");
r = await bot.submit("/signup", "acceptTerms", { ...signupFields("botty"), acceptTerms: "on", website: "http://spam.example" });
check(r.text.includes("blocked") && !bot.cookies.size, "honeypot field filled -> signup blocked");
const fastBot = new Client("fast");
fastBot.fast = true;
r = await fastBot.submit("/signup", "acceptTerms", { ...signupFields("speedy"), acceptTerms: "on" });
check(r.text.includes("too fast") && !fastBot.cookies.size, "instant (bot-speed) signup blocked");
const forged = new Client("forged");
r = await forged.submit("/signup", "acceptTerms", { ...signupFields("forger"), acceptTerms: "on", formToken: "lzz.forged" });
check(r.text.includes("expired") && !forged.cookies.size, "forged bot-check token rejected");
check((await anonPage("/signup")).headers.get("content-security-policy")?.includes("nonce-"), "pages send a nonce-based Content-Security-Policy");

// ---- uploads -------------------------------------------------------------
let up = await alice.upload({ title: "Public pic", description: "hello", visibility: "public", status: "published" }, { blob: new Blob([PNG], { type: "image/png" }), name: "pic.png" });
check(up.status === 201, `upload public image -> 201 (${up.status} ${JSON.stringify(up.body)})`);
const publicId = up.body.id;
// Sharing goes both ways: what the admin publishes reaches members, and the reverse.
up = await owner.upload({ title: "Admin announcement", visibility: "public", status: "published" }, { blob: new Blob([PNG], { type: "image/png" }), name: "notice.png" });
check(up.status === 201, "admin uploads public content");
const adminItemId = up.body.id;
check((await member1.get("/")).text.includes("Admin announcement"), "members see the admin's content in the feed");
check((await member1.get(`/c/${adminItemId}`)).status === 200, "members open the admin's content page");
check((await member1.get(`/api/files/${adminItemId}`)).status === 200, "members load the admin's file");
check((await member1.get("/u/owner1")).text.includes("Admin announcement"), "the admin's profile lists their public content");
check((await owner.get("/")).text.includes("Public pic"), "the admin sees members' content in the feed");

up = await alice.upload({ title: "Secret notes", visibility: "private", status: "published" }, { blob: new Blob(["top secret text"], { type: "text/plain" }), name: "notes.txt" });
check(up.status === 201, "upload private text -> 201");
const privateId = up.body.id;
up = await alice.upload({ title: "evil", visibility: "public", status: "published" }, { blob: new Blob(["<svg onload=alert(1)>"], { type: "image/svg+xml" }), name: "x.svg" });
check(up.status === 400 && up.body.fieldErrors?.file, "SVG upload rejected");
up = await alice.upload({ title: "fake", visibility: "public", status: "published" }, { blob: new Blob(["MZ\x90\x00 this is really an exe"], { type: "image/png" }), name: "photo.png" });
check(up.status === 400 && /contents/.test(up.body.fieldErrors?.file ?? ""), "renamed executable (.exe as .png) rejected by magic-byte check");
const crossSite = await fetch(BASE + "/api/content", { method: "POST", headers: { origin: "https://evil.example", cookie: alice.cookieHeader() }, body: new FormData() });
check(crossSite.status === 403, "cross-origin upload request blocked");
up = await new Client("anon").upload({ title: "x", visibility: "public", status: "published" }, { blob: new Blob([PNG], { type: "image/png" }), name: "a.png" });
check(up.status === 401, "anonymous upload -> 401");

// ---- folders and multi-file posts -----------------------------------------
{
  const fd = new FormData();
  for (const [k, v] of Object.entries({ title: "My project", description: "", visibility: "public", status: "published" })) fd.append(k, v);
  const files = [
    ["project/src/app.js", "console.log('hi');\n", "text/javascript"],
    ["project/index.html", "<h1>hi</h1><script>alert(1)</script>", "text/html"],
    ["project/README.md", "# Project\n", ""],
    ["project/logo.png", PNG, "image/png"],
  ];
  for (const [path, body, type] of files) {
    fd.append("file", new Blob([body], { type }), path.split("/").pop());
    fd.append("path", path);
  }
  const res = await alice.req("/api/content", { method: "POST", body: fd });
  const json = await res.json();
  check(res.status === 201, `folder upload with code files -> 201 (${res.status} ${JSON.stringify(json)})`);
  const page = await member1.get(`/c/${json.id}`);
  check(page.status === 200 && page.text.includes("project/src/app.js") && page.text.includes("Download all"), "folder page lists every file");
  const fileId = page.text.match(new RegExp(`/api/files/${json.id}/([0-9a-f-]{36})\\?download`))?.[1];
  const one = await member1.req(`/api/files/${json.id}/${fileId}`);
  check(one.status === 200 && one.headers.get("content-type")?.startsWith("text/plain") && one.headers.get("content-security-policy")?.includes("sandbox"), "a file inside the folder is served as sandboxed plain text");
  const zip = await member1.req(`/api/files/${json.id}`);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  check(zip.status === 200 && zip.headers.get("content-type") === "application/zip" && bytes[0] === 0x50 && bytes[1] === 0x4b, "Download all returns a .zip");
  check(new TextDecoder().decode(bytes).includes("project/src/app.js"), "the .zip keeps the folder structure");
  const bad = new FormData();
  for (const [k, v] of Object.entries({ title: "bad", visibility: "public", status: "published" })) bad.append(k, v);
  bad.append("file", new Blob(["a"], { type: "text/plain" }), "a.txt");
  bad.append("path", "../../etc/a.txt");
  check((await alice.req("/api/content", { method: "POST", body: bad })).status === 400, "path traversal in a folder path is rejected");
  const env = new FormData();
  for (const [k, v] of Object.entries({ title: "secrets", visibility: "public", status: "published" })) env.append(k, v);
  env.append("file", new Blob(["KEY=1"], { type: "" }), ".env");
  check((await alice.req("/api/content", { method: "POST", body: env })).status === 400, ".env files are refused");
}

// ---- messages ----------------------------------------------------------------
r = await member1.submit("/messages", 'name="body"', { body: "Hello admin, quick question" });
check(r.status === 200 || r.status === 303, "member sends a message to the admin");
check((await owner.get("/admin/messages")).text.includes("Hello admin, quick question"), "admin sees the member's message in the inbox");
const threadId = (await owner.get("/admin/messages")).text.match(/\/admin\/messages\/([0-9a-f-]{36})/)?.[1];
r = await owner.submit(`/admin/messages/${threadId}`, 'name="body"', { body: "Hi! Here is the answer" });
check((await member1.get("/messages")).text.includes("Hi! Here is the answer"), "member sees the admin's reply");
check(!(await alice.get("/messages")).text.includes("Hello admin, quick question"), "other members cannot see someone else's thread");
r = await owner.submit("/admin/messages", 'name="body"', { body: "Server maintenance tonight" });
check((await alice.get("/messages")).text.includes("Server maintenance tonight"), "every member sees announcements");
check((await member1.get("/admin/messages")).status === 404, "members cannot open the admin inbox");

// ---- visibility ----------------------------------------------------------
const anon = new Client("anon");
check((await anon.get("/")).text.includes("Public pic"), "public item on Explore");
check(!(await anon.get("/")).text.includes("Secret notes"), "private item NOT on Explore");
check((await anon.get(`/c/${publicId}`)).status === 200, "anon can view public item");
check((await anon.get(`/c/${privateId}`)).status === 404, "anon gets 404 for private item");
check((await anon.get(`/api/files/${privateId}`)).status === 404, "anon gets 404 for private file");
const pubFile = await anon.get(`/api/files/${publicId}`);
check(pubFile.status === 200 && pubFile.headers.get("content-type") === "image/png" && pubFile.headers.get("x-content-type-options") === "nosniff", "public file served with type + nosniff");
check(/sandbox/.test(pubFile.headers.get("content-security-policy") ?? ""), "file response sandboxed by CSP");
const ownPriv = await alice.get(`/c/${privateId}`);
check(ownPriv.status === 200 && ownPriv.text.includes("top secret text"), "owner sees own private item with text preview");

const bob = new Client("bob");
await bob.submit("/signup", "acceptTerms", { ...signupFields("bob"), acceptTerms: "on" });
check((await bob.get(`/c/${privateId}`)).status === 404, "other user gets 404 for private item");
check((await bob.get("/admin")).status === 404, "regular user gets 404 on /admin");
check((await bob.get("/admin/users")).status === 404, "regular user gets 404 on /admin/users");
check((await anon.get("/dashboard")).location?.includes("/login"), "anon redirected from dashboard to login");

// ---- super admin ---------------------------------------------------------
const admin = new Client("admin");
r = await admin.submit("/login", "password", { email: ADMIN_EMAIL, password: "wrong-password-xyz" });
check(r.text.includes("Incorrect email or password"), "wrong admin password rejected");
r = await admin.submit("/login", "password", { email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PASSWORD });
check(r.status === 303 && r.location?.includes("/admin"), `admin login (env credentials) redirects to /admin (${r.status} ${r.location})`);
const dash = await admin.get("/admin");
check(dash.status === 200 && dash.text.includes("Team Shelf") && dash.text.includes("Super Admin"), "super admin dashboard renders");
check((await admin.get("/admin/users")).text.includes("alice@example.test"), "admin sees all users");
const adminPriv = await admin.get(`/c/${privateId}`);
check(adminPriv.status === 200 && adminPriv.text.includes("top secret text") && adminPriv.text.includes("recorded in the audit log"), "admin can open private content (with logged-access notice)");
check((await admin.get("/admin/audit?action=admin.content.view")).text.includes(privateId.slice(0, 8)), "admin private-content view is in the audit log");

// moderation: reason required, then remove
r = await admin.submit(`/c/${publicId}`, "Remove from platform", { reason: "" });
check(r.text.includes("Give a short reason"), "remove without reason rejected");
r = await admin.submit(`/c/${publicId}`, "Remove from platform", { reason: "Spam test" });
check(r.status === 200, "admin removes content");
check((await anon.get(`/c/${publicId}`)).status === 404, "removed content hidden from public");
check((await anon.get(`/api/files/${publicId}`)).status === 404, "removed file hidden from public");
check((await alice.get("/dashboard")).text.includes("Spam test"), "owner sees removal reason on dashboard");
r = await admin.submit(`/c/${publicId}`, ">Restore<", {});
check((await anon.get(`/c/${publicId}`)).status === 200, "restored content is public again");

// user management
const bobRow = (await admin.get("/admin/users?q=bob")).text.match(/\/admin\/users\/([0-9a-f-]{36})/);
const bobId = bobRow?.[1];
check(Boolean(bobId), "found bob in admin user search");
r = await admin.submit(`/admin/users/${bobId}`, ">Suspend<", { reason: "Testing suspension" });
check((await bob.get("/dashboard")).location?.includes("/login"), "suspended user's existing session is killed");
r = await bob.submit("/login", "password", { email: "bob@example.test", password: "a-long-password-1" });
check(r.text.includes("suspended"), "suspended user can't sign in (sees reason)");
r = await admin.submit(`/admin/users/${bobId}`, ">Unsuspend<", {});
r = await bob.submit("/login", "password", { email: "bob@example.test", password: "a-long-password-1" });
check(r.status === 303, "unsuspended user can sign in again");

// owner edit + admin can't edit
r = await alice.submit(`/c/${privateId}/edit`, "Save changes", { title: "Renamed notes", description: "", visibility: "unlisted", status: "published" });
check(r.status === 303 && (await anon.get(`/c/${privateId}`)).text.includes("Renamed notes"), "owner edits title + makes it unlisted");
check((await admin.get(`/c/${privateId}/edit`)).status === 404, "admin can't open the edit page for someone else's content");


// ---- account settings ------------------------------------------------------
const carol = new Client("carol");
await carol.submit("/signup", "acceptTerms", { ...signupFields("carol"), acceptTerms: "on" });
const carolOther = new Client("carol-2");
await carolOther.submit("/login", "password", { email: "carol@example.test", password: "a-long-password-1" });
check((await carolOther.get("/dashboard")).status === 200, "carol signed in on a second device");
r = await carol.submit("/settings", "Save profile", { displayName: "Carol Renamed" });
check(r.text.includes("Profile saved"), "display name updated");
r = await carol.submit("/settings", "Change password", { currentPassword: "wrong-one-xx", newPassword: "another-long-pass-2", confirmPassword: "another-long-pass-2" });
check(r.text.includes("isn&#x27;t your current password") || r.text.includes("isn't your current password"), "wrong current password rejected");
r = await carol.submit("/settings", "Change password", { currentPassword: "a-long-password-1", newPassword: "another-long-pass-2", confirmPassword: "another-long-pass-2" });
check(r.text.includes("Password changed"), "password changed");
check((await carol.get("/dashboard")).status === 200, "current session survives password change");
check((await carolOther.get("/dashboard")).location?.includes("/login"), "other sessions signed out after password change");
up = await carol.upload({ title: "Carol file", visibility: "public", status: "published" }, { blob: new Blob([PNG], { type: "image/png" }), name: "c.png" });
const carolItem = up.body.id;
r = await carol.submit("/settings", "Delete my account", { password: "another-long-pass-2", confirm: "nope" });
check(r.text.includes("Type DELETE"), "delete requires typing DELETE");
r = await carol.submit("/settings", "Delete my account", { password: "another-long-pass-2", confirm: "DELETE" });
check(r.status === 303 && r.location?.includes("account=deleted"), "account deleted, redirected home");
check((await anon.get("/c/" + carolItem)).status === 404 && (await admin.get("/c/" + carolItem)).status === 404, "deleted account content is gone (even for admin)");
check((await anon.get("/u/carol")).status === 404, "deleted user profile gone");
r = await new Client("c3").submit("/login", "password", { email: "carol@example.test", password: "another-long-pass-2" });
check(r.text.includes("Incorrect email or password"), "deleted account cannot sign in");
r = await new Client("c4").submit("/signup", "acceptTerms", { ...signupFields("carol"), acceptTerms: "on" });
check(r.status === 303, "email + username are free again after deletion (PII scrubbed)");
check((await admin.get("/admin/audit?action=account.")).text.includes("account.delete"), "account deletion is audit-logged");
check((await admin.get("/settings")).text.includes("managed") || (await admin.get("/settings")).text.includes("server configuration"), "super admin settings explain env-managed credentials");

// ---- server admin powers -----------------------------------------------------
const ownerPriv = await owner.get(`/c/${privateId}`);
check(ownerPriv.status === 200 && ownerPriv.text.includes("top secret text"), "server admin can open a member private item (consented at sign-up)");
const saRow = (await owner.get("/admin/users?q=superadmin")).text.match(/\/admin\/users\/([0-9a-f-]{36})/);
check(Boolean(saRow) && (await owner.get(`/admin/users/${saRow[1]}`)).text.includes("No actions available"), "server admin cannot suspend or remove the super admin");

const audit = await admin.get("/admin/audit");
for (const a of ["auth.signup", "auth.tos_accepted", "content.create", "admin.content.remove", "admin.content.restore", "admin.user.suspend", "auth.login_failed", "content.update"]) {
  check(audit.text.includes(a), `audit log contains ${a}`);
}
check((await anon.get("/terms")).text.includes("Administrator powers and your consent"), "terms page has admin powers section");
check((await anon.get("/privacy")).text.includes("Administrator access to your data"), "privacy page has admin access section");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
