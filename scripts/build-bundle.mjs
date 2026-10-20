#!/usr/bin/env node
/**
 * Packages the production build into the app bundle the Windows installer
 * downloads:  dist/openshelf-app.zip  (+ .sha256)
 *
 * Run after `npm run build` (needs `output: "standalone"`):  npm run bundle
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(DIST, "openshelf-app");
const ZIP = path.join(DIST, "openshelf-app.zip");
const STANDALONE = path.join(ROOT, ".next", "standalone");

function fail(msg) {
  console.error(`build-bundle: ${msg}`);
  process.exit(1);
}

if (!existsSync(path.join(STANDALONE, "server.js"))) fail("no standalone build found. Run `npm run build` first.");

rmSync(OUT, { recursive: true, force: true });
rmSync(ZIP, { force: true });

const copy = (from, to) => cpSync(from, to, { recursive: true, dereference: true });
copy(STANDALONE, OUT);
copy(path.join(ROOT, ".next", "static"), path.join(OUT, ".next", "static"));
if (existsSync(path.join(ROOT, "public"))) copy(path.join(ROOT, "public"), path.join(OUT, "public"));
copy(path.join(ROOT, "drizzle"), path.join(OUT, "drizzle"));
copy(path.join(ROOT, "installer", "app", "openshelf.mjs"), path.join(OUT, "openshelf.mjs"));

// Never ship local secrets or data: standalone output copies .env* files from the project.
for (const name of readdirSync(OUT)) {
  if (name.startsWith(".env") || name === ".data") rmSync(path.join(OUT, name), { recursive: true, force: true });
}
const leaked = readdirSync(OUT).filter((n) => n.startsWith(".env") || n === ".data");
if (leaked.length) fail(`refusing to package secrets: ${leaked.join(", ")}`);

const { version } = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
writeFileSync(path.join(OUT, "VERSION"), `${version}\n`);

// Zip with Windows' bundled bsdtar (also available on GitHub's Windows runners).
const tar = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "bsdtar";
const res = spawnSync(tar, ["-a", "-c", "-f", ZIP, "-C", DIST, "openshelf-app"], { stdio: "inherit" });
if (res.status !== 0) fail("creating the zip failed");

const hash = createHash("sha256").update(readFileSync(ZIP)).digest("hex");
writeFileSync(`${ZIP}.sha256`, `${hash}  openshelf-app.zip\n`);
console.log(`Bundle: ${path.relative(ROOT, ZIP)} (${(statSync(ZIP).size / 1048576).toFixed(1)} MB)\nSHA-256: ${hash}`);
