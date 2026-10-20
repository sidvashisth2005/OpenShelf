# Releasing OpenShelf

Releases are built by GitHub Actions (`.github/workflows/release.yml`) when you push a version tag.

1. Bump `"version"` in `package.json` (for example `0.2.0`).
2. Write the notes for this release in `RELEASE_NOTES.md`.
3. Commit, then tag and push:

   ```bash
   git commit -am "Release 0.2.0"
   git tag v0.2.0
   git push && git push --tags
   ```

The workflow checks that the tag matches `package.json`, runs typecheck, lint and tests, builds the app bundle and
`OpenShelf.exe`, runs the installer's self-test, and publishes a GitHub Release with three assets:
`OpenShelf.exe`, `openshelf-app.zip` and `openshelf-app.zip.sha256`.

## Linking releases to the Super Admin panel

If `installer/panel.json` exists (written by `npm run panel:setup`, see
[INSTALL.md](INSTALL.md#3-set-up-the-super-admin-panel-platform-owner)), the bundle includes it and every server
running that release reports to the panel. Commit it before you tag. After `npm run panel:rotate-key`, release
again so servers trust the new signing key.

## Update popups for existing users

Installed copies check the **GitHub Releases** every time the app is opened. They never look at plain
commits. A popup is shown **only** when there is a release newer than the installed version whose notes
contain this line (it is invisible on the GitHub page):

  ```
  <!-- notify-users -->
  ```

So for small fixes, leave the marker out: people get the fix the next time they reinstall or update, but
nobody is interrupted. For a big feature release, add the marker at the top of `RELEASE_NOTES.md`. The first
few lines of the notes appear in the popup, so lead with the headline feature.

Since 0.4.2, a small unmarked release never hides a marked one: someone on 0.3.0 still gets the popup for a
marked 0.5.0 even after 0.5.1 (unmarked) is out. The popup shows the marked release's highlights and installs the
newest version. (Copies older than 0.4.2 only look at the newest release.)

You can also add or remove the marker afterwards by editing the release on GitHub. Installed apps read the live
release text.

In the popup, users choose **Yes** (download the new `OpenShelf.exe` and update; data is kept), **No** (ask
again next time) or **Cancel** (skip this version). Setting `UPDATE_CHECK=false` in
`%LOCALAPPDATA%\OpenShelf\data\config.env` turns the check off.

## Code signing (removes the SmartScreen warning)

Windows SmartScreen warns about downloaded `.exe` files that aren't Authenticode-signed by a publisher with
reputation. The PowerShell one-liner (`install.ps1`) avoids the prompt today: files fetched by
`Invoke-WebRequest` don't carry the browser's "downloaded from the internet" mark, and the script verifies the
SHA-256 before running anything. To make the **downloaded exe** trusted too, sign it:

1. **Get a code-signing certificate.** Options, cheapest first:
   - [SignPath Foundation](https://signpath.org): free signing for open-source projects. You apply and they review.
   - [Azure Artifact Signing](https://learn.microsoft.com/azure/trusted-signing/) (formerly Trusted Signing): a
     low monthly fee, with identity verification by Microsoft.
   - An OV certificate from a CA (Sectigo, DigiCert, SSL.com…), usually delivered on a hardware token or as a
     cloud HSM.
2. **For a `.pfx` certificate,** add two repository secrets (*Settings → Secrets and variables → Actions*):
   - `WINDOWS_CERT_PFX_BASE64`: the output of `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))`
   - `WINDOWS_CERT_PASSWORD`: the `.pfx` password

   The release workflow then signs `OpenShelf.exe` automatically (timestamped, SHA-256) before it computes the
   checksum. SignPath and Azure have their own GitHub Actions; add them at the same point in
   `release.yml`.
3. A signed exe builds SmartScreen reputation as people download it. The warning disappears once enough
   installs accumulate, so keep signing every release with the same certificate.
