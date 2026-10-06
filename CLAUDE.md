# CLAUDE.md

## Rules

### 1. Keep a rolling changelog of the last 3 changes

After finishing a piece of work, add an entry to the **Changelog** section below
describing what was changed.

- Newest entry goes at the **top**.
- Keep **only the 3 most recent entries**. Delete anything older, the changelog
  must never contain more than 3 entries.
- Each entry: a date heading plus a short bullet list of what actually changed
  (files touched and why).

### 2. Never use em dashes

No `—` anywhere: not in quotes, patch notes, store copy, documentation, code
comments, or commit messages. Use a comma, a colon, brackets, or a full stop
and a second sentence.

En dashes (`–`) are out too. A plain hyphen in a compound word (`AI-powered`)
is fine.

### 3. Every change goes in the in-app patch notes

Anything a user could notice goes in `patchNotes.js`, in the voice the existing
entries use. Bug fix, tweak, one-word copy change, it does not matter how small.
If it changed on their screen, it gets a line.

- Add it to the entry for the version it ships in, creating that entry if it
  does not exist yet, and bump `version` in `app.json` to match.
- Match the existing tone. Sections are headed Added, Changed, Fixed, Removed,
  or a joke in the same shape.
- Invisible plumbing (a dependency, a test, a build setting) stays out. It
  belongs in the changelog below, not in front of users.
- Before any release build, check the notes against the commits since the last
  release. Two fixes were missed this way once already.

### 4. Commit and push when the work is done

Once an edit or task is finalized, not after every individual file edit, but
when the work is finished and verified, commit the changes with a descriptive
message and push to `origin`.

- One commit per finished unit of work, including the CLAUDE.md changelog update.
- Push immediately after committing.

## Changelog

### 2026-10-06: Make app.config.js CommonJS for server-side builds

- `app.config.js`: `export default` became `module.exports`. Compared with
  pull-up-tracker, whose GitHub builds dispatch, the only config Expo must
  execute server-side is this file, and the old form throws
  `SyntaxError: Unexpected token 'export'` under a plain `require()` because
  the package has no `"type": "module"`. Local tooling transpiles it, which is
  why CLI builds never noticed. Verified: `expo config` output is byte for byte
  identical before and after, with and without `SHEETPOSO_PLAY_BUILD=1`.
- `.eas/workflows/play-build.yml` (from earlier today) and the `eas.json`
  image change stay: both are harmless and the workflow gives the session a
  second dispatch route. Build plumbing, no patch note.

### 2026-10-06: Add a manual Play build workflow

- `.eas/workflows/play-build.yml` (new): an EAS workflow that builds the
  production Android bundle. Dispatch only, never on push, so it cannot spend
  build credits by itself. Exists because the Expo connector's direct build
  trigger fails for this project with an unexplained internal error, while a
  workflow run goes through a different path. Build plumbing, no patch note.

### 2026-10-05: Set the build image so GitHub-triggered builds can dispatch

- `eas.json`: `android.image: "latest"` on the preview and production
  profiles. Expo's docs list an explicit `image` as a prerequisite for builds
  triggered from GitHub, and the connector was failing every attempt with an
  unexplained internal error. Build plumbing only, so no patch note.
