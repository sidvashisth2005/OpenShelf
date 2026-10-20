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

## Update popups for existing users

Installed copies check the **latest GitHub Release** every time the app is opened. They never look at plain
commits. A popup is shown **only** when both of these are true:

- the release version is newer than the installed one, and
- the release notes contain this line (it is invisible on the GitHub page):

  ```
  <!-- notify-users -->
  ```

So for small fixes, leave the marker out: people get the fix the next time they reinstall or update, but
nobody is interrupted. For a big feature release, add the marker at the top of `RELEASE_NOTES.md`. The first
few lines of the notes appear in the popup, so lead with the headline feature.

You can also add or remove the marker afterwards by editing the release on GitHub. Installed apps read the live
release text.

In the popup, users choose **Yes** (download the new `OpenShelf.exe` and update; data is kept), **No** (ask
again next time) or **Cancel** (skip this version). Setting `UPDATE_CHECK=false` in
`%LOCALAPPDATA%\OpenShelf\data\config.env` turns the check off.
