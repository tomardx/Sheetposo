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

### 2026-08-19: Bump the app version to 1.1.0

- `app.json`: version was still 1.0.0 while the in-app patch notes announced
  1.1.0, so Google Play would have shown testers the wrong number. versionCode
  is untouched, EAS manages it remotely.

### 2026-08-19: Bring RARITY.md up to date

- `RARITY.md`: rewritten. It still opened with "proposal, not built" and
  described tier names, colours, and a weighting scheme that were all replaced
  before shipping, so it actively misdescribed the app. Now documents the
  shipped tiers, how a pull works, where rarity shows up, and how to promote a
  quote.

### 2026-08-19: Seen filters by tier

- `App.js`: the Seen sheet gains a chip row filtering by rarity. Only tiers
  the user has actually pulled are offered, so the filter never hints at what
  is still out there. Chips carry their tier colour and a count, the filter
  clears when the sheet reopens, and the row hides entirely below two tiers.
- `rarity.js`: added `short` labels for the chips, since "Somewhere between
  rare and legendary" does not fit on one. `tierOf()` is now memoised: it runs
  per render, per Seen row, and per candidate on every weighted pull, and it
  was taking the test suite from 5s to 338s on its own.
- `patchNotes.js`: the tier section is headed "Seven deadly tiers".
