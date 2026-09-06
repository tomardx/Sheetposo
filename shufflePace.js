import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sheetposo:shufflePace";

// Nothing here blocks anything. The app notices a run of shuffles, says
// something about it, and gets out of the way.
//
// This replaced a hard limit of two a day. The limit was calibrated against
// one tester who read the entire collection in an afternoon, and it punished
// the ordinary case just as hard: a co-founder described dipping in to read a
// few and leaving, several times a day, which two shuffles does not cover.
//
// What actually spoils the app is pace, not volume. A quote landing at a
// random moment is the joke; thirty in a row is a list. So the count that
// matters is consecutive shuffles, not daily ones. Someone who opens the app
// three times a day and reads a few each time never sees a word of this.

// A gap longer than this ends the run and the count starts again.
export const RUN_GAP_MS = 3 * 60 * 1000;

// Fires on the exact count, so each line appears once per run. After the last
// one the app goes quiet rather than nagging, which the last line promises.
export const NUDGES = [
  {
    at: 11,
    text: "That is eleven in a row. The joke needs a gap. The gap is the joke.",
  },
  {
    at: 20,
    text: "Twenty. You are not reading these any more, you are processing them.",
  },
  {
    at: 35,
    text: "Thirty-five. At this rate you finish before dinner, and then what.",
  },
  {
    at: 60,
    text: "Sixty. We will stop saying it out loud. We are still counting.",
  },
];

export function nudgeFor(count) {
  const hit = NUDGES.find((nudge) => nudge.at === count);
  return hit ? hit.text : null;
}

function normalise(value) {
  if (!value || typeof value !== "object") return { count: 0, lastAt: 0 };
  const count = Number(value.count);
  const lastAt = Number(value.lastAt);
  if (!Number.isFinite(count) || !Number.isFinite(lastAt)) {
    return { count: 0, lastAt: 0 };
  }
  return { count: Math.max(0, Math.floor(count)), lastAt: Math.max(0, lastAt) };
}

// Counts one shuffle and reports what, if anything, to say about it. The
// shuffle itself has already happened by the time this is called: the count is
// a comment on the action, never a gate in front of it.
export async function registerShuffle(now = Date.now()) {
  let stored = null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    stored = raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Could not read the shuffle pace:", error);
  }

  const previous = normalise(stored);
  const continuing = previous.lastAt > 0 && now - previous.lastAt <= RUN_GAP_MS;
  const count = continuing ? previous.count + 1 : 1;

  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ count, lastAt: now }));
  } catch (error) {
    console.warn("Could not save the shuffle pace:", error);
  }

  return { count, message: nudgeFor(count) };
}
