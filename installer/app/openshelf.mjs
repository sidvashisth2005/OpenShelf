#!/usr/bin/env node
/**
 * OpenShelf runtime helper, shipped inside the installed app bundle (next to
 * Next.js's standalone server.js). The installer, the desktop shortcuts and
 * the uninstaller all go through this file.
 *
 *   node openshelf.mjs configure --email <e> [--port <n>]   (password on stdin)
 *   node openshelf.mjs start      run the server in the foreground
 *   node openshelf.mjs open       start in the background if needed, then open the browser
 *   node openshelf.mjs stop       stop the background server
 *   node openshelf.mjs selftest   boot a throwaway copy on a temp database and check it
 *
 * Layout:  <install>/runtime (node) · <install>/app (this file) · <install>/data (kept on update)
 */
import { spawn, execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const INSTALL_DIR = path.dirname(APP_DIR);
const DATA_DIR = process.env.OPENSHELF_DATA_DIR || path.join(INSTALL_DIR, "data");
const CONFIG_FILE = path.join(INSTALL_DIR, "data", "config.env");
const PID_FILE = path.join(DATA_DIR, "server.pid");
const DEFAULT_PORT = 4310;

// ---------------------------------------------------------------------------- config

function readConfig() {
  if (!existsSync(CONFIG_FILE)) return {};
  const out = {};
  for (const line of readFileSync(CONFIG_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeConfig(cfg) {
  mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  const body = Object.entries(cfg)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => {
      if (/[\r\n]/.test(String(v))) throw new Error(`Invalid value for ${k}`);
      return `${k}=${v}`;
    })
    .join("\n");
  writeFileSync(CONFIG_FILE, `# OpenShelf configuration (written by the installer)\n${body}\n`);
}

const portOf = (cfg) => Number(process.env.OPENSHELF_PORT || cfg.PORT || DEFAULT_PORT);

// ---------------------------------------------------------------------------- helpers

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

function freePort(preferred) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => {
      const any = net.createServer();
      any.listen(0, "127.0.0.1", () => {
        const { port } = any.address();
        any.close(() => resolve(port));
      });
    });
    srv.listen(preferred, "127.0.0.1", () => srv.close(() => resolve(preferred)));
  });
}

async function healthy(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitHealthy(port, seconds) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await healthy(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function openBrowser(url) {
  if (process.platform === "win32") execFile("cmd.exe", ["/c", "start", "", url], { windowsHide: true });
  else if (process.platform === "darwin") execFile("open", [url]);
  else execFile("xdg-open", [url]);
}

// ---------------------------------------------------------------------------- commands

async function configure() {
  const cfg = readConfig();
  const email = arg("email")?.trim().toLowerCase();
  if (email) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email address.");
    const password = await readStdin();
    if (password.length < 14) throw new Error("The admin password must be at least 14 characters.");
    const { default: bcrypt } = await import("bcryptjs");
    cfg.SUPER_ADMIN_EMAIL = email;
    cfg.SUPER_ADMIN_PASSWORD_HASH_B64 = Buffer.from(await bcrypt.hash(password, 12)).toString("base64");
  }
  if (!cfg.SUPER_ADMIN_EMAIL) throw new Error("No admin configured. Pass --email and the password on stdin.");
  cfg.PORT = String(await freePort(Number(arg("port") || cfg.PORT || DEFAULT_PORT)));
  cfg.PLATFORM_NAME ||= "OpenShelf";
  writeConfig(cfg);
  console.log(`Configured: admin ${cfg.SUPER_ADMIN_EMAIL}, port ${cfg.PORT}`);
}

async function start() {
  const cfg = readConfig();
  mkdirSync(DATA_DIR, { recursive: true });
  Object.assign(process.env, cfg, {
    NODE_ENV: "production",
    EMBEDDED_DB: "true",
    PGLITE_DIR: path.join(DATA_DIR, "db"),
    UPLOAD_DIR: path.join(DATA_DIR, "uploads"),
    PORT: String(portOf(cfg)),
    // Only reachable from this PC.
    HOSTNAME: "127.0.0.1",
  });
  writeFileSync(PID_FILE, String(process.pid));
  const cleanup = () => {
    try {
      if (readFileSync(PID_FILE, "utf8") === String(process.pid)) rmSync(PID_FILE, { force: true });
    } catch {}
  };
  process.on("exit", cleanup);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
  await import(pathToFileURL(path.join(APP_DIR, "server.js")).href);
}

async function open() {
  const port = portOf(readConfig());
  const url = `http://localhost:${port}`;
  if (!(await healthy(port))) {
    mkdirSync(DATA_DIR, { recursive: true });
    const log = openSync(path.join(DATA_DIR, "server.log"), "a");
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "start"], {
      cwd: APP_DIR,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", log, log],
    });
    child.unref();
    if (!(await waitHealthy(port, 90))) {
      console.error(`OpenShelf did not start. See ${path.join(DATA_DIR, "server.log")}`);
      process.exit(1);
    }
  }
  openBrowser(url);
}

function stop() {
  if (!existsSync(PID_FILE)) return console.log("OpenShelf is not running.");
  const pid = Number(readFileSync(PID_FILE, "utf8"));
  try {
    process.kill(pid);
    console.log("OpenShelf stopped.");
  } catch {
    console.log("OpenShelf was not running.");
  }
  rmSync(PID_FILE, { force: true });
}

async function selftest() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "openshelf-selftest-"));
  const port = await freePort(0);
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "start"], {
    cwd: APP_DIR,
    env: { ...process.env, OPENSHELF_DATA_DIR: tmp, OPENSHELF_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));

  const results = [];
  const check = (name, ok) => {
    results.push(ok);
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  };
  const base = `http://127.0.0.1:${port}`;
  const status = async (p) => (await fetch(base + p, { redirect: "manual" })).status;
  try {
    check("server starts and database migrates", await waitHealthy(port, 90));
    check("home page", (await status("/")) === 200);
    check("sign-in page", (await status("/login")) === 200);
    check("sign-up page with terms", (await fetch(`${base}/signup`).then((r) => r.text())).includes("Administrator access"));
    check("terms of service", (await status("/terms")) === 200);
    check("admin area is protected", (await status("/admin")) === 307 || (await status("/admin")) === 404);
    check("private files are not served", (await status("/api/files/00000000-0000-4000-8000-000000000000")) === 404);
  } catch (err) {
    check(`unexpected error: ${err.message}`, false);
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 800));
    rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
  if (results.some((ok) => !ok)) {
    console.error(output.split("\n").slice(-20).join("\n"));
    process.exit(1);
  }
}

const commands = { configure, start, open, stop, selftest };
const cmd = commands[process.argv[2]];
if (!cmd) {
  console.error(`Usage: openshelf.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(2);
}
Promise.resolve(cmd()).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
