#!/usr/bin/env node
/**
 * OpenShelf runtime helper, shipped inside the installed app bundle (next to
 * Next.js's standalone server.js). The installer, the desktop shortcuts and
 * the uninstaller all go through this file.
 *
 *   node openshelf.mjs configure [--port <n>]   pick the port (the owner account is created at /setup)
 *   node openshelf.mjs start      run the server (supervised; restarts when Wi-Fi sharing changes)
 *   node openshelf.mjs reset-password --email <e>   set a new password (asks for it)
 *   node openshelf.mjs open       start in the background if needed, then open the browser
 *   node openshelf.mjs stop       stop the background server
 *   node openshelf.mjs selftest   boot a throwaway copy on a temp database and check it
 *
 * Layout:  <install>/runtime (node) · <install>/app (this file) · <install>/data (kept on update)
 */
import { execFile, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, watchFile, writeFileSync } from "node:fs";
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

/** Prompts without echo when attached to a terminal (used by `reset-password`). */
function askHidden(question) {
  const stdin = process.stdin;
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          return reject(new Error("Cancelled"));
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function readPassword() {
  if (!process.stdin.isTTY) return readStdin();
  const pw = await askHidden("New password (min 10 characters): ");
  if ((await askHidden("Repeat password: ")) !== pw) throw new Error("Passwords don't match.");
  return pw;
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  // Windows PowerShell 5.1 prefixes piped stdin with a UTF-8 BOM; it must not become part of the password.
  return Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "").replace(/\r?\n$/, "");
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
    // Read the bound port back: with preferred = 0 the OS picks one.
    srv.listen(preferred, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
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

/** Picks a free port. The server's owner account is created in the browser on first open (/setup). */
async function configure() {
  const cfg = readConfig();
  cfg.PORT = String(await freePort(Number(arg("port") || cfg.PORT || DEFAULT_PORT)));
  writeConfig(cfg);
  console.log(`Configured: port ${cfg.PORT}`);
}

const NETWORK_FILE = path.join(DATA_DIR, "network.json");

/** Whether the admin turned on "Share on my Wi-Fi" (written by the app's Server settings). */
function lanEnabled() {
  try {
    return JSON.parse(readFileSync(NETWORK_FILE, "utf8")).lan === true;
  } catch {
    return false;
  }
}

/**
 * Supervisor: runs the server as a child process and restarts it when the
 * network mode changes, so Wi-Fi sharing applies without the user doing anything.
 */
async function start() {
  mkdirSync(DATA_DIR, { recursive: true });
  let child;
  let lan = false;
  let restarting = false;

  const launch = () => {
    lan = lanEnabled();
    child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve"], {
      cwd: APP_DIR,
      env: { ...process.env, OPENSHELF_BIND: lan ? "0.0.0.0" : "127.0.0.1" },
      stdio: "inherit",
      windowsHide: true,
    });
    writeFileSync(PID_FILE, JSON.stringify({ supervisor: process.pid, server: child.pid }));
    child.on("exit", (code) => {
      if (restarting) {
        restarting = false;
        return launch();
      }
      rmSync(PID_FILE, { force: true });
      process.exit(code ?? 0);
    });
  };

  watchFile(NETWORK_FILE, { interval: 1000 }, () => {
    if (lanEnabled() !== lan && !restarting) {
      restarting = true;
      child.kill();
    }
  });
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      child?.kill();
      rmSync(PID_FILE, { force: true });
      process.exit(0);
    });
  }
  launch();
}

/** The actual Next.js server (one process); `start` supervises it. */
async function serve() {
  const cfg = readConfig();
  mkdirSync(DATA_DIR, { recursive: true });
  Object.assign(process.env, cfg, {
    NODE_ENV: "production",
    EMBEDDED_DB: "true",
    PGLITE_DIR: path.join(DATA_DIR, "db"),
    UPLOAD_DIR: path.join(DATA_DIR, "uploads"),
    PORT: String(portOf(cfg)),
    // This PC only, unless the admin turned on Wi-Fi sharing.
    HOSTNAME: process.env.OPENSHELF_BIND || "127.0.0.1",
    OPENSHELF_NETWORK_FILE: NETWORK_FILE,
  });
  await import(pathToFileURL(path.join(APP_DIR, "server.js")).href);
}

/** Sets a new password for an account (e.g. the admin forgot theirs). Stops the server first. */
async function resetPassword() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) throw new Error("Usage: openshelf.mjs reset-password --email you@example.com");
  stop();
  await new Promise((r) => setTimeout(r, 1500));
  const password = await readPassword();
  if (password.length < 10) throw new Error("Use at least 10 characters.");
  const [{ default: bcrypt }, { PGlite }] = await Promise.all([import("bcryptjs"), import("@electric-sql/pglite")]);
  const db = new PGlite(path.join(DATA_DIR, "db"));
  try {
    const hash = await bcrypt.hash(password, 12);
    const res = await db.query(
      "update users set password_hash = $1, updated_at = now() where lower(email) = $2 and role <> 'super_admin' returning username",
      [hash, email],
    );
    if (res.rows.length === 0) throw new Error(`No account with the email ${email}.`);
    await db.query("delete from sessions where user_id in (select id from users where lower(email) = $1)", [email]);
    console.log(`Password updated for @${res.rows[0].username}. Open OpenShelf and sign in.`);
  } finally {
    await db.close();
  }
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
  await checkForUpdate();
}

// ---------------------------------------------------------------------------- updates

/**
 * Release-driven update notice. Only *published GitHub Releases* are
 * considered (never plain commits), and a popup is shown only when the
 * release notes contain the opt-in marker  <!-- notify-users -->  so the
 * maintainers decide which releases are worth interrupting people for.
 */
const UPDATE_REPO = "sidvashisth2005/OpenShelf";
const NOTIFY_MARKER = /<!--\s*notify-users\s*-->/i;
const UPDATE_STATE = path.join(INSTALL_DIR, "data", "update.json");

/** Compares dotted versions ("0.10.1" > "0.9.3"); a leading "v" is ignored. */
export function newerThan(a, b) {
  const parse = (v) => String(v).replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

/** Plain-text highlights from markdown release notes (marker and headings stripped). */
export function highlights(body, maxLines = 6) {
  return String(body || "")
    .replace(NOTIFY_MARKER, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, "").replace(/^\s*[-*]\s+/, "• ").replace(/[*_`]/g, "").trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n");
}

function readUpdateState() {
  try {
    return JSON.parse(readFileSync(UPDATE_STATE, "utf8"));
  } catch {
    return {};
  }
}

/** Shows a Yes/No/Cancel dialog on Windows; returns "yes" | "no" | "cancel". */
function ask(title, message) {
  if (process.platform !== "win32") return "no";
  const script =
    "Add-Type -AssemblyName System.Windows.Forms;" +
    "$r = [System.Windows.Forms.MessageBox]::Show($env:OS_MSG, $env:OS_TITLE, 'YesNoCancel', 'Information');" +
    "Write-Output $r";
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    env: { ...process.env, OS_MSG: message, OS_TITLE: title },
    encoding: "utf8",
    windowsHide: true,
  });
  return (r.stdout || "").trim().toLowerCase() || "no";
}

async function checkForUpdate() {
  const cfg = readConfig();
  if (cfg.UPDATE_CHECK === "false") return;
  const current = readFileSync(path.join(APP_DIR, "VERSION"), "utf8").trim();
  let release;
  try {
    const url = process.env.OPENSHELF_UPDATE_URL || `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "OpenShelf-update-check" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return;
    release = await res.json();
  } catch {
    return; // offline or GitHub unreachable: never block opening the app
  }
  const latest = String(release.tag_name || "").replace(/^v/i, "");
  const dryRun = Boolean(process.env.OPENSHELF_UPDATE_DRY_RUN);
  const decide = (msg) => dryRun && console.log(`update-check: ${msg}`);
  if (!latest || !newerThan(latest, current)) return decide(`no popup (latest ${latest || "?"} is not newer than ${current})`);
  if (!NOTIFY_MARKER.test(release.body || "")) return decide(`no popup (${latest} has no notify-users marker)`);
  if (readUpdateState().skipped === latest) return decide(`no popup (${latest} was skipped by the user)`);
  if (dryRun) return decide(`POPUP for ${latest}: ${highlights(release.body).replace(/\n/g, " | ")}`);

  const installer = (release.assets || []).find((a) => a.name === "OpenShelf.exe");
  const notes = highlights(release.body);
  const choice = ask(
    `${release.name || `OpenShelf ${latest}`} is available`,
    `A new version of OpenShelf is available (you have ${current}).\n\n${notes}\n\n` +
      "Yes: update now (your data is kept)\nNo: remind me next time\nCancel: skip this version",
  );
  if (choice === "cancel") {
    writeFileSync(UPDATE_STATE, JSON.stringify({ skipped: latest }));
  } else if (choice === "yes") {
    if (!installer) return openBrowser(release.html_url || `https://github.com/${UPDATE_REPO}/releases/latest`);
    const dest = path.join(os.tmpdir(), `OpenShelf-${latest}.exe`);
    const res = await fetch(installer.browser_download_url);
    if (!res.ok) return openBrowser(release.html_url);
    writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    // The installer stops this server, swaps runtime + app and keeps data/.
    spawn("cmd.exe", ["/c", "start", "", dest], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }
}

function stop() {
  if (!existsSync(PID_FILE)) return console.log("OpenShelf is not running.");
  const raw = readFileSync(PID_FILE, "utf8");
  // Current format: {"supervisor":…, "server":…}; older installs wrote a bare pid.
  let pids;
  try {
    const p = JSON.parse(raw);
    pids = typeof p === "number" ? [p] : [p.server, p.supervisor];
  } catch {
    pids = [Number(raw)];
  }
  let stopped = false;
  for (const pid of pids.filter(Boolean)) {
    try {
      process.kill(pid);
      stopped = true;
    } catch {
      // already gone
    }
  }
  console.log(stopped ? "OpenShelf stopped." : "OpenShelf was not running.");
  rmSync(PID_FILE, { force: true });
}

async function selftest() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "openshelf-selftest-"));
  const port = await freePort(0);
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve"], {
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
    const home = await fetch(`${base}/`, { redirect: "manual" });
    check("new server sends you to setup", home.status === 307 && (home.headers.get("location") ?? "").endsWith("/setup"));
    check("setup page", (await fetch(`${base}/setup`).then((r) => r.text())).includes("Set up your server"));
    check("sign-up waits for setup", (await status("/signup")) === 307);
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

// Run the CLI only when executed directly (tests import the helpers above).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const commands = { configure, start, serve, open, stop, selftest, "reset-password": resetPassword, "check-update": checkForUpdate };
  const cmd = commands[process.argv[2]];
  if (!cmd) {
    console.error(`Usage: openshelf.mjs <${Object.keys(commands).join("|")}>`);
    process.exit(2);
  }
  Promise.resolve(cmd()).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
