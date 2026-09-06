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

### 2026-08-26: Stop the Seen count going past the total

- `seenQuotes.js`: history is keyed by text, which survives a reordered list
  but not a deleted or rewritten quote. Entries matching nothing were still
  counted and still shown, so a tester reached "767 of 766" and could keep
  reading quotes removed with the legacy pack. Entries now resolve against the
  live list through a `canonicalise` helper, and an old history is pruned once
  on read rather than re-filtered forever.
- Same helper folds the display form onto the raw text. Notifications carry raw
  text, but the tray fallback reads the capitalised body, so one quote could
  sit in history twice under two spellings.
- `App.js`: `absorb` resolves too, since tray entries reach state without
  passing through storage first.
- `__tests__/seenQuotes.test.js`: 6 new tests, including "can never exceed the
  size of the quote list". The old tests used invented strings like "a
  delivered quote" and now use real ones. Sabotage-checked: keeping orphans
  fails four.
- `patchNotes.js`: 1.1.2 gains a Fixed section, because collections will shrink
  and people will notice.

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
