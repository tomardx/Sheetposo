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

### 2026-10-05: The enormous freaking phrases update (1.1.4)

- `quotes.js`: 1,023 new quotes in seven commented groups (fitness, health and
  sleep, food, puns, motivational parody, animal facts, home/work/tech/social),
  total 1,789. Audited before insertion: house rules (lowercase start, closing
  punctuation, no dashes, no double quotes), exact and near duplicates against
  the shipped list (two near-duplicates dropped), and content-rating topics
  (gambling, alcohol, drugs, sexual content, bodily functions, eating
  disorders) kept out so the existing rating answers stay true.
  `QUOTES_VERSION` 5 to 6 so scheduled notifications reschedule.
- `rarity.js`: 20 of the new lines promoted (2 legendary, 4 moos, 6 between,
  8 uncommon). Everything else splits into the common tiers by hash as before.
- `patchNotes.js` and `app.json`: 1.1.4. Answers the co-founder feedback that
  the app needed more content before it needed more rules.
