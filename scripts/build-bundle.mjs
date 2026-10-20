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
copy(path.join(ROOT, "installer", "openshelf.ico"), path.join(OUT, "openshelf.ico"));

// Turbopack references serverExternalPackages through hashed aliases in .next/node_modules
// (e.g. "bcryptjs-ee66c2bdc904f2cf" -> ../../node_modules/bcryptjs). Those are symlinks, or
// absolute junctions on Windows machines without symlink rights, so rebuild every alias as a
// real copy of the package. The bundle then works wherever it's unzipped.
const aliasRoot = path.join(OUT, ".next", "node_modules");
const aliases = [];
if (existsSync(aliasRoot)) {
  for (const entry of readdirSync(aliasRoot)) {
    if (entry.startsWith("@")) {
      for (const sub of readdirSync(path.join(aliasRoot, entry))) aliases.push(`${entry}/${sub}`);
    } else {
      aliases.push(entry);
    }
  }
}
for (const alias of aliases) {
  const pkg = alias.replace(/-[0-9a-f]{16}$/, "");
  const source = path.join(OUT, "node_modules", pkg);
  if (!existsSync(path.join(source, "package.json"))) fail(`external module ${alias}: ${pkg} is missing from the standalone node_modules`);
  const target = path.join(aliasRoot, alias);
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true, dereference: true });
}
console.log(`Materialized ${aliases.length} external module alias(es): ${aliases.join(", ") || "none"}`);

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
