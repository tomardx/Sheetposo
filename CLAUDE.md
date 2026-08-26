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

### 3. Commit and push when the work is done

Once an edit or task is finalized, not after every individual file edit, but
when the work is finished and verified, commit the changes with a descriptive
message and push to `origin`.

- One commit per finished unit of work, including the CLAUDE.md changelog update.
- Push immediately after committing.

## Changelog

### 2026-08-26: Ration the Shuffle button

- `shuffleBudget.js` (new): two shuffles per rolling 24 hours. The window opens
  at the first shuffle rather than at midnight, so shuffling at 23:55 does not
  buy a fresh pair five minutes later. Stored in AsyncStorage, fails open on a
  read error, and clamps a tampered count.
- `App.js`: Shuffle spends from the budget, dims when spent, and stays
  pressable so the toast can say when it returns. A line under the button shows
  what is left.
- `__tests__/startup.test.js`: 12 tests. The AsyncStorage mock is now a real
  in-memory store, because the old stub returned null for every read and would
  have let an exhausted budget silently refill. Sabotage-checked: removing the
  limit fails three of them.
- Version 1.1.2, with a patch note needling the tester who did it.

Worth knowing: notifications draw from the whole quote list and have never
excluded seen quotes, so reaching the end of the collection does not stop them.
They just repeat.

### 2026-08-26: Make the Seen filters readable, and add expo-updates

- `App.js`, `backgrounds.js`: a tester could not read the tier chips. They were
  drawn in their own tier colour on a background of nearly that colour, and
  several tiers sit within a hair of sage. Chips now use a new `BRAND.ink`
  (near-black, picked so it clears 4.5:1 against all seven tiers), an ink
  border so the pill is always visible, and a tier-coloured dot to keep the
  colour link to the rows. The row wraps instead of scrolling horizontally,
  which is what made the chips look like they had moved. Chip height is fixed
  so Poppins stops getting bottom-clipped. Same fix for the rarity label under
  each quote, and "What's new?" gained a backdrop.
- `__tests__/startup.test.js`: new test computing WCAG contrast for the chip
  text against every tier and for the rarity label against the row, so
  "you can't see anything" is now a number that fails a build.
- `app.json`, `eas.json`, `package.json`: added expo-updates with the
  appVersion runtime policy and a channel per build profile, so the next
  JS-only fix ships without a store release. Version bumped to 1.1.1.
- `patchNotes.js`: 1.1.1 entry.

### 2026-08-19: Bump the app version to 1.1.0

- `app.json`: version was still 1.0.0 while the in-app patch notes announced
  1.1.0, so Google Play would have shown testers the wrong number. versionCode
  is untouched, EAS manages it remotely.
