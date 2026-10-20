#!/usr/bin/env node
/**
 * One-command setup for a cloned repository (installation mode 1).
 *
 *   setup.cmd            (Windows)      ./setup.sh   (macOS / Linux)
 *   node scripts/setup.mjs [--start] [--skip-checks] [--port 3000]
 *
 * Steps: check Node -> install dependencies -> write .env.local (asks for the
 * super admin email + password and stores only a bcrypt hash) -> migrate the
 * embedded database -> typecheck, lint, unit tests -> production build.
 *
 * Non-interactive use (CI): set OPENSHELF_ADMIN_EMAIL and OPENSHELF_ADMIN_PASSWORD.
 */
import { spawnSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getEnvVar, setEnvVar } from "./lib/env-file.mjs";
import { ask, askNewPassword } from "./lib/prompt.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const MIN_NODE = [20, 9];
const isWin = process.platform === "win32";
let stepNo = 0;
const STEPS = flag("skip-checks") ? 5 : 6;

function step(title) {
  stepNo += 1;
  console.log(`\n\x1b[35m[${stepNo}/${STEPS}]\x1b[0m \x1b[1m${title}\x1b[0m`);
}

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit", shell: isWin, ...opts });
  if (res.status !== 0) {
    console.error(`\n\x1b[31mStep failed:\x1b[0m ${cmd} ${cmdArgs.join(" ")}`);
    process.exit(res.status ?? 1);
  }
}

function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
    console.error(`OpenShelf needs Node.js ${MIN_NODE.join(".")} or newer (found ${process.versions.node}).`);
    console.error("Install the LTS version from https://nodejs.org (Windows: winget install OpenJS.NodeJS.LTS).");
    process.exit(1);
  }
  console.log(`  Node.js ${process.versions.node}`);
}

async function configure() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) {
    copyFileSync(path.join(ROOT, ".env.example"), envPath);
    console.log("  Created .env.local from .env.example");
  } else {
    console.log("  Using existing .env.local");
  }
  let text = readFileSync(envPath, "utf8");

  // Single-PC install: production mode with the embedded database unless a real Postgres is configured.
  if (!getEnvVar(text, "DATABASE_URL")) text = setEnvVar(text, "EMBEDDED_DB", "true");

  if (getEnvVar(text, "SUPER_ADMIN_EMAIL") && getEnvVar(text, "SUPER_ADMIN_PASSWORD_HASH_B64")) {
    console.log("  Super admin already configured, keeping it.");
  } else {
    console.log("  Set up the super admin account (only a bcrypt hash of the password is stored).");
    let email = process.env.OPENSHELF_ADMIN_EMAIL?.trim();
    while (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      if (!process.stdin.isTTY) throw new Error("Set OPENSHELF_ADMIN_EMAIL to a valid email for non-interactive setup.");
      email = await ask("  Super admin email: ");
    }
    const password = process.env.OPENSHELF_ADMIN_PASSWORD ?? (await askNewPassword("  Super admin password (min 14 chars)", 14));
    if (password.length < 14) throw new Error("The super admin password must be at least 14 characters.");
    const { default: bcrypt } = await import("bcryptjs");
    const hash = await bcrypt.hash(password, 12);
    text = setEnvVar(text, "SUPER_ADMIN_EMAIL", email.toLowerCase());
    text = setEnvVar(text, "SUPER_ADMIN_PASSWORD_HASH_B64", Buffer.from(hash).toString("base64"));
    console.log(`  Super admin: ${email.toLowerCase()}`);
  }
  writeFileSync(envPath, text);
}

async function main() {
  console.log("\x1b[1mOpenShelf setup\x1b[0m");
  step("Checking Node.js");
  checkNode();

  step("Installing dependencies");
  run("npm", [existsSync(path.join(ROOT, "package-lock.json")) ? "ci" : "install", "--no-audit", "--no-fund"]);

  step("Configuring .env.local");
  await configure();

  step("Preparing the database");
  run("npm", ["run", "db:migrate"]);

  if (!flag("skip-checks")) {
    step("Running checks (typecheck, lint, unit tests)");
    run("npm", ["run", "typecheck"]);
    run("npm", ["run", "lint"]);
    run("npm", ["test"]);
  }

  step("Building the app");
  run("npm", ["run", "build"]);

  const port = option("port", "3000");
  console.log(`\n\x1b[32mSetup complete.\x1b[0m Start OpenShelf with:\n\n  npm start -- -p ${port}\n\nthen open http://localhost:${port}`);

  if (flag("start")) {
    console.log("\nStarting OpenShelf… (Ctrl+C to stop)");
    spawn("npm", ["start", "--", "-p", port], { cwd: ROOT, stdio: "inherit", shell: isWin });
  }
}

main().catch((err) => {
  console.error(`\n\x1b[31mSetup failed:\x1b[0m ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
