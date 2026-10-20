#!/usr/bin/env node
/**
 * Issues a new Super Admin panel key (the sign-in key) without touching the signing key,
 * so servers stay linked and no new release is needed. The old key stops working.
 *
 *   npm run panel:new-key
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PANEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "panel");
const panelKey = randomBytes(32).toString("base64url");

const r = spawnSync("npx", ["wrangler", "secret", "put", "PANEL_KEY_HASH"], {
  cwd: PANEL,
  input: createHash("sha256").update(panelKey).digest("hex"),
  encoding: "utf8",
  shell: process.platform === "win32",
  stdio: ["pipe", "pipe", "pipe"],
});
if (r.status !== 0) {
  console.error(`Couldn't store the new key in Cloudflare:\n${r.stderr || r.stdout}`);
  console.error("If you aren't logged in, run `cd panel && npx wrangler login` first.");
  process.exit(1);
}

console.log("\n\x1b[32mNew panel key stored.\x1b[0m The old key no longer works.");
console.log("\n\x1b[1mYour panel key (shown only now, store it in a password manager):\x1b[0m\n");
console.log(`  ${panelKey}\n`);
