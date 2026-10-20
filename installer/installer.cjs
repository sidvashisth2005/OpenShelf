/**
 * OpenShelf.exe: the one-file Windows installer (installation mode 2).
 *
 * Built as a Node.js Single Executable Application (see scripts/build-exe.mjs),
 * so it may only use Node built-ins. What it does:
 *   1. downloads a pinned Node.js runtime and the latest OpenShelf app bundle,
 *      verifying both against published SHA-256 checksums
 *   2. installs them per-user under %LOCALAPPDATA%\OpenShelf (no admin rights)
 *   3. picks a free port (the owner creates their account in the browser on first open)
 *   4. runs a self-test against a throwaway database
 *   5. creates Desktop / Start Menu shortcuts and an "Apps & features" uninstaller
 *   6. starts OpenShelf and opens it in the browser
 *
 * Re-running it updates an existing install and keeps all data.
 *
 * Flags (mostly for testing/automation):
 *   --yes  --dir <path>  --port <n>
 *   --app-zip <path>  --node-zip <path>  --no-shortcuts  --no-launch
 */
"use strict";

const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const APP_NAME = "OpenShelf";
const REPO = "sidvashisth2005/OpenShelf";
const NODE_VERSION = "22.16.0";
const NODE_DIST = `https://nodejs.org/dist/v${NODE_VERSION}`;
const NODE_ZIP = `node-v${NODE_VERSION}-win-x64.zip`;
const APP_ZIP_URL = `https://github.com/${REPO}/releases/latest/download/openshelf-app.zip`;

// ------------------------------------------------------------------------------ args

const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const opt = (f) => {
  const i = argv.indexOf(`--${f}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const INSTALL_DIR = path.resolve(opt("dir") || path.join(LOCALAPPDATA, APP_NAME));
const RUNTIME_DIR = path.join(INSTALL_DIR, "runtime");
const APP_DIR = path.join(INSTALL_DIR, "app");
const DATA_DIR = path.join(INSTALL_DIR, "data");
const NODE_EXE = path.join(RUNTIME_DIR, "node.exe");
const CLI = path.join(APP_DIR, "openshelf.mjs");
const TAR = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");

// ------------------------------------------------------------------------------ ui

const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
let stepNo = 0;
const TOTAL = 5;
const step = (t) => console.log(`\n${c(35, `[${++stepNo}/${TOTAL}]`)} ${c(1, t)}`);
const info = (t) => console.log(`  ${t}`);

class InstallError extends Error {}

/** Aborts the installation; main() reports it and waits for Enter before closing. */
function fail(msg) {
  throw new InstallError(msg);
}

function pauseThenExit(code) {
  if (has("yes") || !process.stdin.isTTY) process.exit(code);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("\nPress Enter to close…", () => process.exit(code));
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => (rl.close(), res(a.trim()))));
}


// ------------------------------------------------------------------------------ io

function download(url, dest, label, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error(`Too many redirects for ${url}`));
    https
      .get(url, { headers: { "User-Agent": `${APP_NAME}-installer` } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(download(new URL(res.headers.location, url).href, dest, label, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`${label}: HTTP ${res.statusCode} from ${url}`));
        }
        const total = Number(res.headers["content-length"]) || 0;
        let done = 0;
        let last = 0;
        const out = fs.createWriteStream(dest);
        res.on("data", (chunk) => {
          done += chunk.length;
          const now = Date.now();
          if (process.stdout.isTTY && now - last > 150) {
            last = now;
            const pct = total ? ` ${Math.floor((done / total) * 100)}%` : "";
            process.stdout.write(`\r  ${label}: ${(done / 1048576).toFixed(1)} MB${pct}   `);
          }
        });
        res.pipe(out);
        out.on("finish", () => {
          if (process.stdout.isTTY) process.stdout.write("\n");
          out.close(() => resolve(dest));
        });
        out.on("error", reject);
      })
      .on("error", reject);
  });
}

function fetchText(url) {
  const tmp = path.join(os.tmpdir(), `openshelf-${crypto.randomUUID()}.txt`);
  return download(url, tmp, "checksums").then(() => {
    const t = fs.readFileSync(tmp, "utf8");
    fs.rmSync(tmp, { force: true });
    return t;
  });
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function verify(file, expected, label) {
  const actual = sha256(file);
  if (!expected || actual !== expected.toLowerCase()) {
    fail(`${label} checksum mismatch (expected ${expected || "?"}, got ${actual}). The download may be corrupted or tampered with.`);
  }
  info(`${label} checksum verified`);
}

function extract(zip, intoDir) {
  fs.mkdirSync(intoDir, { recursive: true });
  const r = spawnSync(TAR, ["-x", "-f", zip, "-C", intoDir], { stdio: "inherit" });
  if (r.status !== 0) fail(`could not extract ${path.basename(zip)}`);
}

function runNode(args, input) {
  return spawnSync(NODE_EXE, [CLI, ...args], {
    cwd: APP_DIR,
    input,
    stdio: [input === undefined ? "inherit" : "pipe", "inherit", "inherit"],
    windowsHide: true,
  });
}

function powershell(script, env) {
  const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "PowerShell failed").trim());
  return r.stdout;
}

// ------------------------------------------------------------------------------ steps

async function getNode(tmp) {
  step("Downloading the Node.js runtime");
  const zip = path.join(tmp, NODE_ZIP);
  let expected;
  if (opt("node-zip")) {
    fs.copyFileSync(path.resolve(opt("node-zip")), zip);
    info(`Using local ${path.basename(opt("node-zip"))}`);
    expected = sha256(zip);
  } else {
    const sums = await fetchText(`${NODE_DIST}/SHASUMS256.txt`);
    expected = sums.split("\n").find((l) => l.trim().endsWith(` ${NODE_ZIP}`))?.split(/\s+/)[0];
    await download(`${NODE_DIST}/${NODE_ZIP}`, zip, `Node.js ${NODE_VERSION}`);
  }
  verify(zip, expected, "Node.js");
  const stage = path.join(tmp, "node");
  extract(zip, stage);
  fs.rmSync(RUNTIME_DIR, { recursive: true, force: true });
  fs.renameSync(path.join(stage, `node-v${NODE_VERSION}-win-x64`), RUNTIME_DIR);
  info(`Runtime installed to ${RUNTIME_DIR}`);
}

async function getApp(tmp) {
  step(`Downloading ${APP_NAME}`);
  const zip = path.join(tmp, "openshelf-app.zip");
  let expected;
  if (opt("app-zip")) {
    const src = path.resolve(opt("app-zip"));
    fs.copyFileSync(src, zip);
    info(`Using local ${path.basename(src)}`);
    const sidecar = `${src}.sha256`;
    expected = fs.existsSync(sidecar) ? fs.readFileSync(sidecar, "utf8").split(/\s+/)[0] : sha256(zip);
  } else {
    expected = (await fetchText(`${APP_ZIP_URL}.sha256`)).split(/\s+/)[0];
    await download(APP_ZIP_URL, zip, APP_NAME);
  }
  verify(zip, expected, APP_NAME);
  const stage = path.join(tmp, "app");
  extract(zip, stage);
  fs.rmSync(APP_DIR, { recursive: true, force: true });
  fs.renameSync(path.join(stage, "openshelf-app"), APP_DIR);
  const version = fs.readFileSync(path.join(APP_DIR, "VERSION"), "utf8").trim();
  info(`${APP_NAME} ${version} installed to ${APP_DIR}`);
  return version;
}

/** Picks a free port. The owner creates their admin account in the browser on first open. */
function configure() {
  const r = runNode(["configure", ...(opt("port") ? ["--port", opt("port")] : [])], "");
  if (r.status !== 0) fail("could not write the configuration");
}

function selfTest() {
  step("Testing the installation");
  const r = runNode(["selftest"]);
  if (r.status !== 0) fail("the self-test did not pass, so OpenShelf was not set up. Please report this on GitHub.");
}

function writeHelpers(version) {
  const q = (s) => s.replace(/"/g, '""');
  const vbs = (cmd) =>
    `Set sh = CreateObject("WScript.Shell")\r\nsh.Run """${q(NODE_EXE)}"" ""${q(CLI)}"" ${cmd}", 0, False\r\n`;
  fs.writeFileSync(path.join(INSTALL_DIR, "OpenShelf.vbs"), vbs("open"));
  fs.writeFileSync(path.join(INSTALL_DIR, "Stop OpenShelf.vbs"), vbs("stop"));

  const uninstall = `# OpenShelf uninstaller (per-user)
$ErrorActionPreference = "SilentlyContinue"
$dir = "${INSTALL_DIR.replace(/"/g, '`"')}"
& "$dir\\runtime\\node.exe" "$dir\\app\\openshelf.mjs" stop | Out-Null
Add-Type -AssemblyName System.Windows.Forms
$keep = [System.Windows.Forms.MessageBox]::Show("Keep your OpenShelf data (database, uploads and settings)?\`n\`nChoose No to delete everything.", "Uninstall OpenShelf", "YesNoCancel", "Question")
if ($keep -eq "Cancel") { exit 1 }
$desktop = [Environment]::GetFolderPath("Desktop")
$programs = [Environment]::GetFolderPath("Programs")
Remove-Item "$desktop\\OpenShelf.lnk" -Force
Remove-Item "$programs\\OpenShelf" -Recurse -Force
Remove-Item "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OpenShelf" -Recurse -Force
Start-Sleep -Milliseconds 800
Remove-Item "$dir\\runtime","$dir\\app","$dir\\OpenShelf.vbs","$dir\\Stop OpenShelf.vbs" -Recurse -Force
if ($keep -eq "No") { Remove-Item "$dir\\data" -Recurse -Force }
Remove-Item "$dir\\uninstall.ps1" -Force
if (-not (Get-ChildItem $dir)) { Remove-Item $dir -Force }
[System.Windows.Forms.MessageBox]::Show("OpenShelf has been uninstalled.", "OpenShelf") | Out-Null
`;
  fs.writeFileSync(path.join(INSTALL_DIR, "uninstall.ps1"), `\ufeff${uninstall}`);
  return version;
}

function registerShortcuts(version) {
  step("Creating shortcuts");
  if (has("no-shortcuts")) return info("Skipped (--no-shortcuts)");
  const script = `
$ws = New-Object -ComObject WScript.Shell
$dir = $env:OS_DIR
$programs = Join-Path ([Environment]::GetFolderPath("Programs")) "OpenShelf"
New-Item -ItemType Directory -Force -Path $programs | Out-Null
function Link($path, $target, $arguments, $desc) {
  $l = $ws.CreateShortcut($path)
  $l.TargetPath = $target; $l.Arguments = $arguments; $l.WorkingDirectory = $dir
  $l.IconLocation = "$dir\\app\\openshelf.ico,0"; $l.Description = $desc; $l.Save()
}
$wscript = "$env:SystemRoot\\System32\\wscript.exe"
Link ([IO.Path]::Combine([Environment]::GetFolderPath("Desktop"), "OpenShelf.lnk")) $wscript """$dir\\OpenShelf.vbs""" "Open OpenShelf"
Link "$programs\\OpenShelf.lnk" $wscript """$dir\\OpenShelf.vbs""" "Open OpenShelf"
Link "$programs\\Stop OpenShelf.lnk" $wscript """$dir\\Stop OpenShelf.vbs""" "Stop the OpenShelf server"
$ps = "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
Link "$programs\\Uninstall OpenShelf.lnk" $ps "-NoProfile -ExecutionPolicy Bypass -File ""$dir\\uninstall.ps1""" "Uninstall OpenShelf"
$key = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OpenShelf"
New-Item -Path $key -Force | Out-Null
Set-ItemProperty $key DisplayName "OpenShelf"
Set-ItemProperty $key DisplayVersion $env:OS_VERSION
Set-ItemProperty $key Publisher "OpenShelf contributors"
Set-ItemProperty $key InstallLocation $dir
Set-ItemProperty $key DisplayIcon "$dir\\app\\openshelf.ico"
Set-ItemProperty $key URLInfoAbout "https://github.com/${REPO}"
Set-ItemProperty $key UninstallString "$ps -NoProfile -ExecutionPolicy Bypass -File ""$dir\\uninstall.ps1"""
Set-ItemProperty $key NoModify 1 -Type DWord
Set-ItemProperty $key NoRepair 1 -Type DWord
`;
  try {
    powershell(script, { OS_DIR: INSTALL_DIR, OS_VERSION: version });
    info("Desktop and Start Menu shortcuts created; uninstaller registered in Apps & features");
  } catch (err) {
    info(c(33, `Could not create shortcuts (${err.message}). You can start OpenShelf with ${path.join(INSTALL_DIR, "OpenShelf.vbs")}`));
  }
}

function launch() {
  step(`Starting ${APP_NAME}`);
  if (has("no-launch")) return info("Skipped (--no-launch)");
  const r = runNode(["open"]);
  if (r.status !== 0) fail("OpenShelf could not start. See data\\server.log");
  info("OpenShelf has opened in your browser. Create your admin account there to finish.");
}

// ------------------------------------------------------------------------------ main

async function main() {
  if (process.platform !== "win32") fail("OpenShelf.exe is for Windows. On macOS/Linux, clone the repo and run ./setup.sh.");
  console.log(c(1, `\n  ${APP_NAME} installer\n`));
  const isUpdate = fs.existsSync(path.join(DATA_DIR, "config.env"));
  info(`Install folder: ${INSTALL_DIR}${isUpdate ? "  (update: your data is kept)" : ""}`);
  info("Downloads Node.js and OpenShelf (about 60 MB) and sets everything up. No admin rights needed.");
  if (!has("yes")) {
    const a = await ask(`\n  Continue? [Y/n] `);
    if (/^n/i.test(a)) return pauseThenExit(0);
  }

  fs.mkdirSync(INSTALL_DIR, { recursive: true });
  if (isUpdate && fs.existsSync(NODE_EXE) && fs.existsSync(CLI)) runNode(["stop"]);
  // Stage inside the install folder: renaming across drives (e.g. %TEMP% on C:, install on D:) fails with EXDEV.
  const tmp = fs.mkdtempSync(path.join(INSTALL_DIR, ".staging-"));
  try {
    await getNode(tmp);
    const version = await getApp(tmp);
    configure();
    selfTest();
    writeHelpers(version);
    registerShortcuts(version);
    launch();
    console.log(`\n${c(32, `${APP_NAME} ${version} is installed.`)} Open it any time from the Desktop or Start Menu.`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  pauseThenExit(0);
}

main().catch((err) => {
  console.error(`\n${c(31, "Installation failed:")} ${err instanceof Error ? err.message : String(err)}`);
  pauseThenExit(1);
});
