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

### 2026-09-06: Replace the shuffle limit with a pacing nudge

- `shufflePace.js` (new, replaces `shuffleBudget.js`): nothing is blocked. The
  app counts consecutive shuffles and remarks at 11, 20, 35 and 60, then goes
  quiet. A gap over 3 minutes ends the run, so someone who opens the app a few
  times a day and reads a few each time never sees any of it.
- The hard limit of two a day was calibrated against one tester who read all
  766 in an afternoon, and it broke the ordinary case. Pace is what spoils the
  app, not volume, so the count is consecutive rather than daily.
- `App.js`: the shuffle happens first and unconditionally, and the count is
  registered afterwards, so a storage failure costs the remark rather than the
  shuffle. The "N left" caption and the dimmed button are gone.
- `__tests__/startup.test.js`: 10 tests, including one that shuffles past every
  threshold and asserts the quote changes every time. Sabotage-checked: a run
  that never resets fails one, nudges that repeat forever fail three.
- `patchNotes.js`: 1.1.3 gains a "Changed, again" section.

### 2026-09-06: Reopen on the last poster instead of re-rolling

- `lastPoster.js` (new): stores the quote and background on every change and
  restores them on launch. The quote is kept as text and resolved against the
  live list on read, like the seen history, so a quote deleted in a later
  release cannot strand anyone. An out-of-range background index is treated as
  absent rather than rendering nothing.
- `App.js`: poster state was seeded from `randomQuote()` on every mount and
  never persisted, so a cold start silently re-rolled. One effect now persists
  whatever is on screen, covering shuffle, a notification tap and a pick from
  the seen list without touching each path. The splash waits for the stored
  poster so there is no flash of a random quote, with the existing 5s timeout
  as the escape hatch, and a notification tap still outranks the stored poster.
- `__tests__/startup.test.js`: 9 tests covering cold start, repeated launches,
  each path that sets a quote, the notification race, a deleted quote, an
  out-of-range background, and unreadable storage. Sabotage-checked both ways:
  dropping the save fails five, letting the restore beat the notification
  fails one. The seenQuotes mock also needed `canonicalQuote`.
- `patchNotes.js`: new 1.1.3 entry. 1.1.2 was already built and published, so
  the fix could not go there.

### 2026-09-06: Re-derive every patch note date, and announce the notes

- `patchNotes.js`: the dates were the days work was written, not the days it
  shipped, and two entries shared 19 August. Each is now pinned to the last
  commit its release actually contains: 1.0.2 to 10 August, 1.1.0 to 26 August
  (it was on 19 August, which belongs to 1.0.3), 1.1.1 to 27 August, 1.1.2 to
  6 September. 1.0.3 and 1.0.0 were already right.
- 1.1.1's date is the one inference here. Its work and 1.1.0's landed on the
  same day, so the gap between them is assumed rather than known. Correct it
  from the Play Console Releases tab if it matters.
- Same audit found 1.1.0 shipped the "What's new?" sheet without announcing it,
  so that entry gains an Added section. The patch notes now announce
  themselves, which is the only honest way to write that line.
- Header comment records that `date` means release day, so this does not drift
  again.
