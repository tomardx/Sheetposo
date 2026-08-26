import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sheetposo:shuffleWindow";

// Two shuffles per window. The quote already on screen is free, so this is two
// re-rolls, not two quotes.
export const SHUFFLE_LIMIT = 2;

// The window opens at the first shuffle and runs for a day from there, rather
// than resetting at midnight. Someone who shuffles at 23:55 should not get a
// fresh pair five minutes later.
export const WINDOW_MS = 24 * 60 * 60 * 1000;

// A tester shuffled through 765 of 766 quotes in one sitting and finished the
// collection, which removes the only thing the app has: the drip. Rationing
// re-rolls means the notifications stay the main way quotes arrive.

function empty() {
  return { startedAt: 0, used: 0 };
}

function normalise(value) {
  if (!value || typeof value !== "object") return empty();
  const startedAt = Number(value.startedAt);
  const used = Number(value.used);
  if (!Number.isFinite(startedAt) || !Number.isFinite(used)) return empty();
  // A clamp rather than a reject: a corrupt or hand-edited value should cost
  // the user at most one window, never unlimited shuffles.
  return {
    startedAt: Math.max(0, startedAt),
    used: Math.min(Math.max(0, Math.floor(used)), SHUFFLE_LIMIT),
  };
}

// Rolls an expired window forward. Kept separate from storage so the rules can
// be tested without a mock, and so the UI can re-derive state on a clock tick
// without another read.
export function budgetAt(stored, now) {
  const state = normalise(stored);
  if (state.startedAt === 0 || now - state.startedAt >= WINDOW_MS) {
    return { used: 0, remaining: SHUFFLE_LIMIT, resetsAt: 0 };
  }
  return {
    used: state.used,
    remaining: Math.max(0, SHUFFLE_LIMIT - state.used),
    resetsAt: state.startedAt + WINDOW_MS,
  };
}

export async function loadShuffleBudget(now = Date.now()) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return budgetAt(raw ? JSON.parse(raw) : null, now);
  } catch (error) {
    console.warn("Could not read the shuffle budget:", error);
    // Fail open. A storage problem should not lock someone out of the one
    // button the app has.
    return { used: 0, remaining: SHUFFLE_LIMIT, resetsAt: 0 };
  }
}

// Spends one shuffle. Returns the budget after spending, and `spent: false`
// when there was nothing left, so the caller can tell a refusal from a
// success without comparing counts.
export async function spendShuffle(now = Date.now()) {
  let stored = null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    stored = raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Could not read the shuffle budget:", error);
  }

  const current = budgetAt(stored, now);
  if (current.remaining <= 0) return { ...current, spent: false };

  // A fresh window is stamped at the shuffle that opens it, which is what
  // makes the reset relative to the user rather than to the clock.
  const startedAt = current.resetsAt === 0 ? now : current.resetsAt - WINDOW_MS;
  const next = { startedAt, used: current.used + 1 };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Could not save the shuffle budget:", error);
  }

  return { ...budgetAt(next, now), spent: true };
}

// "6h", "12m", "under a minute". Deliberately coarse: the exact second is not
// information anybody wants, and a ticking countdown invites staring at it.
export function timeUntil(resetsAt, now = Date.now()) {
  const ms = resetsAt - now;
  if (ms <= 0) return "now";
  if (ms < 60000) return "under a minute";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
