# CLAUDE.md

## Rules

### 1. Keep a rolling changelog of the last 3 changes

After finishing a piece of work, add an entry to the **Changelog** section below
describing what was changed.

- Newest entry goes at the **top**.
- Keep **only the 3 most recent entries**. Delete anything older — the changelog
  must never contain more than 3 entries.
- Each entry: a date heading plus a short bullet list of what actually changed
  (files touched and why).

### 2. Commit and push when the work is done

Once an edit or task is finalized — not after every individual file edit, but
when the work is finished and verified — commit the changes with a descriptive
message and push to `origin`.

- One commit per finished unit of work, including the CLAUDE.md changelog update.
- Push immediately after committing.

## Changelog

### 2026-08-19 — Punctuation pass, 454 new quotes, rarity proposal

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

### 2026-08-16 — Add project rules file

- Created `CLAUDE.md` with the rolling 3-entry changelog rule and the
  commit-and-push-when-done rule.
