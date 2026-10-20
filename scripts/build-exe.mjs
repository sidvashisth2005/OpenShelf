#!/usr/bin/env node
/**
 * Builds dist/OpenShelf.exe from installer/installer.cjs as a Node.js Single
 * Executable Application (https://nodejs.org/api/single-executable-applications.html).
 * Must run on Windows (it injects into a copy of the running node.exe):
 *
 *   npm run build:exe
 *
 * The exe gets the OpenShelf icon and version metadata (so Explorer and
 * "Properties" show OpenShelf, not Node.js), plus a .sha256 sidecar.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rcedit } from "rcedit";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const BLOB = path.join(DIST, "sea-prep.blob");
const EXE = path.join(DIST, "OpenShelf.exe");
const CONFIG = path.join(DIST, "sea-config.json");
const ICON = path.join(ROOT, "installer", "openshelf.ico");

if (process.platform !== "win32") {
  console.error("build-exe: run this on Windows (the installer targets Windows).");
  process.exit(1);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`build-exe: ${path.basename(cmd)} ${args.join(" ")} failed`);
    process.exit(r.status ?? 1);
  }
}

const { version } = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

mkdirSync(DIST, { recursive: true });
writeFileSync(
  CONFIG,
  JSON.stringify({ main: path.join(ROOT, "installer", "installer.cjs"), output: BLOB, disableExperimentalSEAWarning: true }, null, 2),
);
run(process.execPath, ["--experimental-sea-config", CONFIG]);

rmSync(EXE, { force: true });
copyFileSync(process.execPath, EXE);

// Icon + version info go in before the SEA blob is injected.
await rcedit(EXE, {
  icon: ICON,
  "file-version": version,
  "product-version": version,
  "version-string": {
    ProductName: "OpenShelf",
    FileDescription: "OpenShelf Installer",
    CompanyName: "OpenShelf contributors",
    LegalCopyright: "MIT License. github.com/sidvashisth2005/OpenShelf",
    OriginalFilename: "OpenShelf.exe",
    InternalFilename: "OpenShelf",
  },
});

run(process.execPath, [
  path.join(ROOT, "node_modules", "postject", "dist", "cli.js"),
  EXE,
  "NODE_SEA_BLOB",
  BLOB,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
]);
rmSync(BLOB, { force: true });
rmSync(CONFIG, { force: true });

const hash = createHash("sha256").update(readFileSync(EXE)).digest("hex");
writeFileSync(`${EXE}.sha256`, `${hash}  OpenShelf.exe\n`);
console.log(`Built ${path.relative(ROOT, EXE)} (${(statSync(EXE).size / 1048576).toFixed(1)} MB)\nSHA-256: ${hash}`);
