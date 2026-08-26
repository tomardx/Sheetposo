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

### 2026-08-19: Remove every em dash

- Added rule 2 to this file: no em dashes or en dashes anywhere.
- Swept all 13 files containing `—` (84 instances), replacing each with a
  comma, a colon in headings and label/value pairs, or a full stop. No em
  dashes existed inside any quote string; they were all in comments, docs,
  store copy, and the patch-note version separator.
- `README.md`: fixed while in there. It still described the removed Copy
  button, the emoji on Shuffle, "~500 quotes", and a 3-day schedule. Now
  documents the current app, and the quote-authoring rules live in one place.

### 2026-08-19: In-app "What's new?" patch notes

- `patchNotes.js`: new file holding release notes as structured data (version,
  date, sections of bullets), written in the app's sarcastic voice.
- `App.js`: small "What's new?" control in the top-right, opening a
  `PatchNotesSheet` styled to match the Seen sheet. Deliberately rendered
  outside the capture layer so it never appears in a shared image.
- `__tests__/startup.test.js`: covers the button, sheet contents, ordering,
  and exclusion from shares. Also rescoped the icon-glyph test to the buttons
  themselves, it scanned the whole tree and would trip over any unrelated
  copy containing "Share".

### 2026-08-19: Punctuation pass, 454 new quotes, rarity proposal

- `quotes.js`: punctuated all 312 existing quotes (contractions, terminal
  marks, capital `I`, proper nouns) after readers complained about the sloppy
  casing; added 454 new witty/cynical/demotivational lines, 766 total.
  Rewrote the header house rules to cover punctuation and voice, and bumped
  `QUOTES_VERSION` to 5 so scheduled notifications carrying the old
  unpunctuated text get re-rolled.
- `quotes.js`: `formatQuote()` now capitalises after each sentence break, not
  just the opening letter, so multi-sentence quotes render correctly.
- `RARITY.md`: new proposal for legendary/mythic/rare tiers with candidate
  assignments and open questions. Nothing implemented.
