import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

const SEEN_KEY = "sheetposo:seenQuotes";
// What the app has scheduled and when, so a notification counts as seen once
// its time passes — whether or not it was tapped, and even if it was swiped
// away before the app was next opened.
const PENDING_KEY = "sheetposo:pendingDeliveries";
// Generous ceiling: the whole list is well under this, but a corrupted or
// runaway history should never grow without bound.
const MAX_SEEN = 5000;

// Stored as text rather than indexes, so the history survives any edit to the
// quote list — including quotes later removed from it. Order is first-seen.
export async function loadSeenQuotes() {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => typeof entry === "string" && entry);
  } catch (error) {
    console.warn("Could not read seen quotes:", error);
    return [];
  }
}

export async function saveSeenQuotes(quotes) {
  try {
    const trimmed = quotes.slice(-MAX_SEEN);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.warn("Could not save seen quotes:", error);
  }
}

async function loadPendingDeliveries() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        entry &&
        typeof entry.text === "string" &&
        entry.text &&
        typeof entry.at === "number"
    );
  } catch (error) {
    console.warn("Could not read pending deliveries:", error);
    return [];
  }
}

// Called after scheduling. Replaces the log, because scheduling always
// cancels and re-books everything that was pending.
export async function setPendingDeliveries(entries) {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn("Could not save pending deliveries:", error);
  }
}

// Moves every notification whose time has passed into the seen history and
// drops it from the log. This is what makes a quote count as seen when it was
// merely delivered — the tray check below only catches ones still sitting
// there, so a dismissed or auto-cleared notification used to be lost.
export async function syncDeliveredIntoSeen(now = Date.now()) {
  const [seen, pending] = await Promise.all([
    loadSeenQuotes(),
    loadPendingDeliveries(),
  ]);
  const due = pending.filter((entry) => entry.at <= now);
  if (due.length === 0) return seen;

  const merged = [...seen];
  for (const entry of due) {
    if (!merged.includes(entry.text)) merged.push(entry.text);
  }
  const stillPending = pending.filter((entry) => entry.at > now);
  await Promise.all([
    saveSeenQuotes(merged),
    setPendingDeliveries(stillPending),
  ]);
  return merged;
}

// A quote sitting in the notification tray has been introduced to the user
// even if they never opened the app, so count those too.
export async function presentedQuotes() {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    if (!Array.isArray(presented)) return [];
    return presented
      .map((item) => {
        const content = item?.request?.content;
        const carried = content?.data?.quoteText;
        if (typeof carried === "string" && carried) return carried;
        return typeof content?.body === "string" ? content.body : null;
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("Could not read presented notifications:", error);
    return [];
  }
}
