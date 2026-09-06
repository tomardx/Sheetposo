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

### 2026-08-26: Back to a real Play release for 1.1.2

- Reverted the OTA prep. Google Play's review counts releases uploaded to the
  track, and an expo-updates OTA never touches Play, so shipping the rationing
  and the Seen fix over the air would have left the closed test showing no
  updates at all during the testing window. The rejection names "acting on user
  feedback through updates to your app" as a criterion, so those updates have
  to be visible to Google.
- `app.json` back to 1.1.2, and the two 1.1.1 patch note entries separated
  again.
- expo-updates stays installed. It is still the right tool for a fix that has
  to reach people in minutes, just not while production access is being
  reviewed.
