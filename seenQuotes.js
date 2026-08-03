import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

const SEEN_KEY = "sheetposo:seenQuotes";
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
