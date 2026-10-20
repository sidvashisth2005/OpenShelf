# Install OpenShelf

Pick the part that's for you:

- [**I want to run a server for my team**](#1-run-a-server-for-your-team-admin) (you become the **admin**)
- [**Someone sent me an invite link**](#2-join-a-server-member) (you're a **member**)
- [**I'm the platform owner**](#3-set-up-the-super-admin-panel-platform-owner) (the **Super Admin** panel)

If something goes wrong, see [Problems?](#problems).

---

## 1. Run a server for your team (admin)

You need a Windows 10 or 11 PC and internet during the install. You don't need admin rights or any accounts.

### Install: 2 clicks and one paste

1. Press the <kbd>Windows</kbd> key, type **PowerShell**, and press <kbd>Enter</kbd>.
2. Paste this line (right-click pastes) and press <kbd>Enter</kbd>:

   ```powershell
   irm https://raw.githubusercontent.com/sidvashisth2005/OpenShelf/main/install.ps1 | iex
   ```

3. When it asks `Continue? [Y/n]`, press <kbd>Enter</kbd>.

Wait about a minute. OpenShelf **opens in your browser** by itself.

### Create your admin account

The browser shows **Set up your server**. Fill in:

- a **server name** (for example, *Design Team*)
- your **name**, **email** and a **password**

Click **Create my server**. You're the admin. Nothing else to configure.

From now on, open OpenShelf from the **OpenShelf** icon on your Desktop or in the Start Menu.

### Invite your team

1. Go to **Admin → Server settings** and turn on **Share on my Wi-Fi**. Click **Save settings**.
   - If Windows asks whether to allow OpenShelf on the network, click **Allow**.
   - Wait about 5 seconds, then reload the page.
2. Go to **Admin → Invite links** and click **Create link**.
3. Click **Copy** under **On the same Wi-Fi** (copy it now: it is shown only once) and send it to your team (WhatsApp, email, anything).

That's it. Keep OpenShelf running on your PC while people use it.

> **Tip:** your teammates must be on the same Wi-Fi as your PC. Home and team networks work best; some office,
> hotel and café networks block devices from talking to each other.

---

## 2. Join a server (member)

1. Open the invite link you were sent, on any phone or laptop on the **same Wi-Fi** as the server.
2. Pick a username, enter your email and a password.
3. Read the short note about what the admin can see, tick the box, and click **Create account**.

You agree to that once. You won't be asked again.

Done. Upload with the **Upload** button, and find your files under **My content**.

Nothing to install for members. It works in any browser.

---

## 3. Set up the Super Admin panel (platform owner)

**Only the platform owner does this, once.** Admins and members never need it.

The panel is a free Cloudflare website that lists every admin server that's online. From it you can open any
server as Super Admin. It costs nothing: it uses Cloudflare's free Workers and D1 plans, and it doesn't need your
PC to be on.

**You need:** a free [Cloudflare account](https://dash.cloudflare.com/sign-up), [Node.js 20.9+](https://nodejs.org)
and [Git](https://git-scm.com).

### Step 1: get the code

```powershell
git clone https://github.com/sidvashisth2005/OpenShelf.git
cd OpenShelf
npm install
```

### Step 2: log in to Cloudflare (once)

```powershell
cd panel
npx wrangler login
cd ..
```

A browser tab opens. Click **Allow**.

### Step 3: create the panel

```powershell
npm run panel:setup
```

It creates the database, keys and the website, and prints two things:

- **The panel address**, like `https://openshelf-panel.<you>.workers.dev`
- **Your panel key**, a long code shown **only this once**. Save it in a password manager right away.

### Step 4: link admin servers to your panel

`panel:setup` wrote the file `installer/panel.json`. Commit it and publish a new release (see
[RELEASING.md](RELEASING.md)):

```powershell
git add installer/panel.json panel/wrangler.toml
git commit -m "Link releases to the Super Admin panel"
git push
```

Every admin who installs or updates to that release links to your panel automatically. Nobody has to type
anything.

### Using the panel

Open your panel address and sign in with your panel key. You see each server, whether it's online, its members
and its content. Click **Open live server** to sign in to that server as Super Admin.

- **Lost the key, or think someone saw it?** Run `npm run panel:setup -- --rotate-key`. That gives you a new
  key and signing keys. Publish a new release afterwards so servers trust the new signing key.
- **Changed the panel code?** Run `npm run panel:setup` again. It keeps your key and just redeploys.

---

## Updating

- **Admins:** when an important update is out, OpenShelf shows a popup the next time you open it. Click **Yes**.
  Your data is kept. To update yourself at any time, run the install line again.
- **Members:** nothing to do.

## Uninstalling

**Settings → Apps → Installed apps → OpenShelf → Uninstall.** It asks whether to keep your data.

---

## Problems?

<details>
<summary><b>"Windows protected your PC" or "isn't commonly downloaded"</b></summary>

That only happens if you downloaded `OpenShelf.exe` instead of using the PowerShell line. Click **More info → Run
anyway** (or in the browser's downloads: **… → Keep → Show more → Keep anyway**). The PowerShell line avoids this
and checks the download's SHA-256 for you.
</details>

<details>
<summary><b>Teammates can't open the Wi-Fi link</b></summary>

- Check that **Share on my Wi-Fi** is on (Admin → Server settings).
- Check that everyone is on the **same** Wi-Fi.
- In Windows, set your Wi-Fi to **Private**: Settings → Network & internet → Wi-Fi → your network → **Private
  network**.
- If you clicked **Cancel** on the Windows firewall question, open **Allow an app through Windows Firewall** and
  tick **Private** for **Node.js**.
</details>

<details>
<summary><b>OpenShelf doesn't open</b></summary>

Double-click the **OpenShelf** icon again. If it still doesn't open, run the install line again; it repairs the
install and keeps your data.
</details>

<details>
<summary><b>I forgot my admin password</b></summary>

In PowerShell:

```powershell
cd $env:LOCALAPPDATA\OpenShelf\app
..\runtime\node.exe openshelf.mjs reset-password --email you@example.com
```

Type the new password twice, then open OpenShelf again.
</details>

<details>
<summary><b>A server doesn't show up in the Super Admin panel</b></summary>

- The server's PC must be on, with OpenShelf running and internet access.
- The server must run a release that includes `installer/panel.json` (see step 4 above). Updating fixes it.
- It appears within about a minute of starting.
</details>

<details>
<summary><b>macOS or Linux</b></summary>

Install [Node.js 20.9+](https://nodejs.org), then:

```bash
git clone https://github.com/sidvashisth2005/OpenShelf.git
cd OpenShelf
./setup.sh
npm start
```

Open <http://localhost:3000> and create your admin account. More in the [developer guide](docs/DEVELOPMENT.md).
</details>

Still stuck? [Open an issue](https://github.com/sidvashisth2005/OpenShelf/issues).
