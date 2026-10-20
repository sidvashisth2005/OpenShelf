#!/usr/bin/env node
/**
 * One-time setup + deploy of the free Super Admin panel (Cloudflare Worker + D1).
 *
 *   cd panel && npx wrangler login      (once; approve in the browser)
 *   npm run panel:setup                 (from the repo root)
 *
 * Creates the D1 database, applies the schema, generates the panel key (shown once)
 * and the Ed25519 signing key, stores them as Worker secrets, deploys, and writes
 * installer/panel.json so the next release links admin servers to this panel.
 * Re-running it redeploys; pass --rotate-key to issue a new panel key.
 */
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PANEL = path.join(ROOT, "panel");
const STATE = path.join(PANEL, ".panel-state.json"); // gitignored: which secrets are already set
const isWin = process.platform === "win32";

function wrangler(args, { input, capture = true } = {}) {
  const r = spawnSync("npx", ["wrangler", ...args], {
    cwd: PANEL,
    input,
    encoding: "utf8",
    shell: isWin,
    stdio: [input === undefined ? "inherit" : "pipe", capture ? "pipe" : "inherit", capture ? "pipe" : "inherit"],
  });
  if (r.status !== 0) {
    console.error(`\nwrangler ${args.join(" ")} failed:\n${(r.stderr || "") + (r.stdout || "")}`);
    process.exit(1);
  }
  return `${r.stdout ?? ""}${r.stderr ?? ""}`;
}

const step = (t) => console.log(`\n\x1b[35m»\x1b[0m \x1b[1m${t}\x1b[0m`);

step("Checking the Cloudflare login");
if (!existsSync(path.join(PANEL, "node_modules"))) {
  spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: PANEL, stdio: "inherit", shell: isWin });
}
const who = wrangler(["whoami"]);
if (/not authenticated|You are not logged in/i.test(who)) {
  console.error("Run `cd panel && npx wrangler login` first, approve in the browser, then run this again.");
  process.exit(1);
}
console.log("  Logged in.");

step("Creating the D1 database (free)");
const list = JSON.parse(wrangler(["d1", "list", "--json"]).replace(/^[^[]*/, ""));
let db = list.find((d) => d.name === "openshelf-panel");
if (!db) {
  wrangler(["d1", "create", "openshelf-panel"]);
  db = JSON.parse(wrangler(["d1", "list", "--json"]).replace(/^[^[]*/, "")).find((d) => d.name === "openshelf-panel");
}
const dbId = db.uuid ?? db.database_id;
const tomlPath = path.join(PANEL, "wrangler.toml");
writeFileSync(tomlPath, readFileSync(tomlPath, "utf8").replace(/database_id = ".*"/, `database_id = "${dbId}"`));
console.log(`  Database ${dbId}`);
wrangler(["d1", "execute", "openshelf-panel", "--remote", "--file", "schema.sql", "--yes"]);
console.log("  Schema applied.");

step("Preparing keys");
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
let panelKey;
if (!state.publicKey || process.argv.includes("--rotate-key")) {
  panelKey = randomBytes(32).toString("base64url");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const secrets = {
    PANEL_KEY_HASH: createHash("sha256").update(panelKey).digest("hex"),
    SESSION_SECRET: randomBytes(32).toString("base64url"),
    SIGNING_JWK: JSON.stringify(privateKey.export({ format: "jwk" })),
  };
  for (const [name, value] of Object.entries(secrets)) wrangler(["secret", "put", name], { input: value });
  state.publicKey = publicKey.export({ format: "jwk" }).x;
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log("  Secrets stored in Cloudflare.");
} else {
  console.log("  Keeping the existing keys (use --rotate-key for new ones).");
}

step("Deploying the panel");
const out = wrangler(["deploy"]);
const url = out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0];
if (!url) {
  console.error(out);
  process.exit(1);
}
state.url = url;
writeFileSync(STATE, JSON.stringify(state, null, 2));
writeFileSync(path.join(ROOT, "installer", "panel.json"), `${JSON.stringify({ url, publicKey: state.publicKey }, null, 2)}\n`);
console.log(`  Live at ${url}`);
console.log("  Wrote installer/panel.json: the next release links admin servers to this panel.");

console.log(`\n\x1b[32mDone.\x1b[0m Open ${url}`);
if (panelKey) {
  console.log("\n\x1b[1mYour panel key (shown only now, store it in a password manager):\x1b[0m\n");
  console.log(`  ${panelKey}\n`);
}
