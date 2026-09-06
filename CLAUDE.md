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

### 2026-09-06: Correct the 1.1.2 patch note date

- `patchNotes.js`: 1.1.2 was dated 26 August, the day the work was written, not
  the day it ships. Now 6 September. Patch note dates are release dates, not
  commit dates.
- Still unverified: 1.1.0 is dated 19 August but the rarity work landed on the
  26th, so one of the two is wrong. Left alone pending the real Play release
  date.

### 2026-08-26: Make the patch notes a rule, and fill two gaps

- `CLAUDE.md`: new rule 3. Anything a user could notice goes in `patchNotes.js`,
  in the existing voice, however small. Invisible plumbing stays out and belongs
  in this changelog instead. Check the notes against the commits before every
  release build.
- `patchNotes.js`: two fixes shipped in 1.1.1 were never written up. The filter
  labels were being vertically clipped, and the "What's new?" control was almost
  unreadable on darker posters. Both now have lines under 1.1.1.
