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
 * Re-running it redeploys; `npm run panel:rotate-key` issues a new panel key.
 */
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PANEL = path.join(ROOT, "panel");
const STATE = path.join(PANEL, ".panel-state.json"); // gitignored: which secrets are already set
const isWin = process.platform === "win32";

let panelKey;

function wrangler(args, { input, capture = true, env } = {}) {
  const r = spawnSync("npx", ["wrangler", ...args], {
    cwd: PANEL,
    input,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: isWin,
    stdio: [input === undefined ? "inherit" : "pipe", capture ? "pipe" : "inherit", capture ? "pipe" : "inherit"],
  });
  if (r.status !== 0) {
    console.error(`\nwrangler ${args.join(" ")} failed.`);
    if (capture) console.error(`${r.stderr || ""}${r.stdout || ""}`);
    if (panelKey) console.error("Your panel key above stays valid. Fix the problem and run `npm run panel:setup` again.");
    process.exit(1);
  }
  return `${r.stdout ?? ""}${r.stderr ?? ""}`;
}

/** Parses the JSON array in wrangler's output, ignoring any warnings printed around it. */
const jsonArray = (out) => JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1));

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
const list = jsonArray(wrangler(["d1", "list", "--json"]));
let db = list.find((d) => d.name === "openshelf-panel");
if (!db) {
  wrangler(["d1", "create", "openshelf-panel"]);
  db = jsonArray(wrangler(["d1", "list", "--json"])).find((d) => d.name === "openshelf-panel");
}
const dbId = db.uuid ?? db.database_id;
const tomlPath = path.join(PANEL, "wrangler.toml");
writeFileSync(tomlPath, readFileSync(tomlPath, "utf8").replace(/database_id = ".*"/, `database_id = "${dbId}"`));
console.log(`  Database ${dbId}`);
wrangler(["d1", "execute", "openshelf-panel", "--remote", "--file", "schema.sql", "--yes"]);
console.log("  Schema applied.");

step("Preparing keys");
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
if (!state.publicKey || (process.argv.includes("--rotate-key") || process.env.npm_config_rotate_key)) {
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
  // Printed now, not at the end, so a failed deploy can never lose it.
  console.log("\n\x1b[1mYour panel key (shown only now, store it in a password manager):\x1b[0m\n");
  console.log(`  ${panelKey}\n`);
} else {
  console.log("  Keeping the existing keys (`npm run panel:rotate-key` makes new ones).");
}

step("Deploying the panel");
// Not captured, so wrangler can ask you to pick a workers.dev subdomain the first time.
// The deployed address is read from wrangler's machine-readable output file instead.
const outFile = path.join(PANEL, ".wrangler-output.ndjson");
rmSync(outFile, { force: true });
wrangler(["deploy"], { capture: false, env: { WRANGLER_OUTPUT_FILE_PATH: outFile } });
const records = existsSync(outFile)
  ? readFileSync(outFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
rmSync(outFile, { force: true });
const url = records.flatMap((r) => (r.type === "deploy" ? (r.targets ?? []) : [])).find((t) => /\.workers\.dev\/?$/.test(t))?.replace(/\/$/, "");
if (!url) {
  console.error("Deployed, but wrangler reported no workers.dev address. Check Workers & Pages in the Cloudflare dashboard.");
  process.exit(1);
}
state.url = url;
writeFileSync(STATE, JSON.stringify(state, null, 2));
writeFileSync(path.join(ROOT, "installer", "panel.json"), `${JSON.stringify({ url, publicKey: state.publicKey }, null, 2)}\n`);
console.log(`  Live at ${url}`);
console.log("  Wrote installer/panel.json: the next release links admin servers to this panel.");

console.log(`\n\x1b[32mDone.\x1b[0m Open ${url}${panelKey ? " and sign in with the panel key printed above." : ""}`);
