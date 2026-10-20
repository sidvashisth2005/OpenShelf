<p align="center">
  <img src="branding/logo.svg" width="96" height="96" alt="OpenShelf logo">
</p>

<h1 align="center">OpenShelf</h1>

<p align="center">
  <b>Your own content library on your own PC.</b><br>
  Upload photos, videos, music, PDFs and notes, and share them publicly, by link, or keep them private.
</p>

<p align="center">
  <a href="https://github.com/sidvashisth2005/OpenShelf/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/sidvashisth2005/OpenShelf?color=7c3aed&label=release"></a>
  <a href="https://github.com/sidvashisth2005/OpenShelf/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/sidvashisth2005/OpenShelf/ci.yml?branch=main&label=tests"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-db2777"></a>
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4">
</p>

<p align="center">
  <img src="docs/screenshots/home.png" alt="OpenShelf home page" width="900">
</p>

---

## Install in 1 minute (Windows)

**Step 1.** Open **PowerShell**: press the <kbd>Windows</kbd> key, type `PowerShell`, and press <kbd>Enter</kbd>.

**Step 2.** Copy this line, paste it into PowerShell (right-click pastes), and press <kbd>Enter</kbd>:

```powershell
irm https://raw.githubusercontent.com/sidvashisth2005/OpenShelf/main/install.ps1 | iex
```

**Step 3.** Answer three questions:

| It asks | You type |
| --- | --- |
| `Continue? [Y/n]` | <kbd>Enter</kbd> |
| `Admin email:` | your email, for example `you@example.com` |
| `Admin password:` | a password of at least 14 characters, typed twice. It stays hidden while you type, which is normal. |

That's it. OpenShelf installs, tests itself, and **opens in your browser**. Next time, open it from the
**OpenShelf** icon on your Desktop or in the Start Menu.

<p align="center">
  <img src="docs/screenshots/installer.png" alt="The installer running in PowerShell" width="800">
</p>

> **Why PowerShell and not a download button?** The command downloads the official installer from this
> repository, checks that it hasn't been changed (SHA-256), and runs it. You skip the browser's "isn't
> commonly downloaded" and SmartScreen warnings that unsigned new apps get.

<details>
<summary><b>Prefer downloading the .exe?</b></summary>

1. Download **[OpenShelf.exe](https://github.com/sidvashisth2005/OpenShelf/releases/latest/download/OpenShelf.exe)**.
2. If your browser says *"OpenShelf.exe isn't commonly downloaded"*: open the downloads list, choose **…** →
   **Keep** → **Show more** → **Keep anyway**.
3. Double-click it. If Windows shows *"Windows protected your PC"*, click **More info** → **Run anyway**.
4. Answer the same three questions as above.

These warnings appear because the installer isn't code-signed yet. They go away once releases are signed. See
[RELEASING.md](RELEASING.md#code-signing-removes-the-smartscreen-warning).
</details>

<details>
<summary><b>macOS / Linux, or developers</b></summary>

You need [Node.js 20.9 or newer](https://nodejs.org).

```bash
git clone https://github.com/sidvashisth2005/OpenShelf.git
cd OpenShelf
./setup.sh          # Windows: setup.cmd
npm start           # then open http://localhost:3000
```

The setup script installs everything, asks for the admin email and password, runs the tests, and builds the app.
For details, see the [developer guide](docs/DEVELOPMENT.md).
</details>

**What you need:** Windows 10 or 11, an internet connection during install (about 60 MB), and about 300 MB of
disk space. You don't need admin rights.

---

## What you can do

| | |
| --- | --- |
| <img src="docs/screenshots/upload.png" alt="Upload page" width="420"> | **Upload anything.** Drag and drop images, videos, music, PDFs and notes (up to 50 MB each). Give each upload a title and choose who can see it: **Public**, **Unlisted** (only people with the link) or **Private**. |
| <img src="docs/screenshots/dashboard.png" alt="My content dashboard" width="420"> | **Manage your shelf.** See everything you've uploaded, what's public, and how much space it uses. Edit details or delete items at any time. |
| <img src="docs/screenshots/content.png" alt="A content page" width="420"> | **Share a page for every item.** Images, video, audio and text preview right in the page, with Open and Download buttons. |
| <img src="docs/screenshots/admin-overview.png" alt="Admin dashboard" width="420"> | **Run it as the admin.** A dashboard with users, uploads, storage and sign-in activity, plus tools to moderate content and suspend or remove accounts. Every admin action is logged. |
| <img src="docs/screenshots/signup.png" alt="Sign-up page with the administrator access notice" width="420"> | **Be clear with your users.** At sign-up, people see exactly what the admin can access and agree to it once. This is explained in the built-in [Terms](src/lib/legal.ts) and Privacy Policy. |

<p align="center">
  <img src="docs/screenshots/home-dark.png" alt="Dark mode" width="560">
  &nbsp;
  <img src="docs/screenshots/mobile.png" alt="On a phone" width="180">
  <br><sub>Dark mode follows your system setting, and it works on phones too.</sub>
</p>

---

## Using OpenShelf

- **Open:** use the **OpenShelf** icon on the Desktop or in the Start Menu. It starts in the background and opens
  `http://localhost:4310` in your browser.
- **Sign in as admin:** use the email and password you chose during install. You land on the admin dashboard.
- **Let others join:** they open your OpenShelf, click **Get started**, and create their own account.
- **Stop:** Start Menu → **OpenShelf** → **Stop OpenShelf**.
- **Your data** (database, uploads, settings) lives in `%LOCALAPPDATA%\OpenShelf\data`.

> OpenShelf currently listens on `127.0.0.1` only, so it can be opened from **this PC**. Sharing your
> server with other devices is the next big feature on the roadmap.

## Updating

When a big new version comes out, OpenShelf shows a popup the next time you open it. Click **Yes** to update;
your data is kept. Small fixes never interrupt you. To update manually, run the install command again.

## Uninstalling

**Settings → Apps → Installed apps → OpenShelf → Uninstall.** It asks whether to keep your data.

## FAQ

<details>
<summary>Is it safe to run a command from the internet?</summary>

The command only downloads [`install.ps1`](install.ps1) from this repository, so you can read exactly what it
does. It downloads `OpenShelf.exe` from this repository's releases, verifies its SHA-256 checksum, and refuses to
run it if the checksum doesn't match. The installer verifies Node.js and the app bundle the same way.
</details>

<details>
<summary>I forgot my admin password.</summary>

Run the install command again. It keeps your data. To set a new admin password, open PowerShell in
`%LOCALAPPDATA%\OpenShelf\app` and run:

```powershell
..\runtime\node.exe openshelf.mjs configure --email you@example.com
```

Type the new password, press <kbd>Enter</kbd>, then <kbd>Ctrl</kbd>+<kbd>Z</kbd> and <kbd>Enter</kbd>. Restart
OpenShelf afterwards (Stop OpenShelf, then open it again).
</details>

<details>
<summary>Port 4310 is already used on my PC.</summary>

The installer picks a free port automatically if 4310 is taken. The Desktop shortcut always opens the right
address.
</details>

---

## For developers

- [Developer guide](docs/DEVELOPMENT.md): stack, configuration, architecture, roles, database, Docker and scripts.
- [Security](SECURITY.md): the full security checklist, and how to report a vulnerability.
- [Releasing](RELEASING.md): how releases, update popups and code signing work.

OpenShelf is open source under the [MIT license](LICENSE).
