import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKGROUNDS } from "./backgrounds";
import { canonicalQuote } from "./seenQuotes";

const KEY = "sheetposo:lastPoster";

// The poster the app was last showing, so a cold start reopens on it rather
// than rolling a new quote. Re-rolling on launch quietly spent the day's
// reading for anyone who closed the app and came back, and made the shuffle
// limit feel arbitrary: the app was shuffling for free while the user could
// not.
//
// The quote is stored by text, like the seen history, and resolved back
// against the live list on read. A quote deleted in a later release must not
// strand someone on a poster the app no longer has.

export async function loadLastPoster() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const quote = canonicalQuote(parsed.quote);
    if (!quote) return null;

    // A background index from a build with more backgrounds than this one
    // would render nothing at all, so treat anything out of range as absent
    // and let the caller pick.
    const bgIndex = Number(parsed.bgIndex);
    if (!Number.isInteger(bgIndex) || bgIndex < 0 || bgIndex >= BACKGROUNDS.length) {
      return { quote, bgIndex: null };
    }
    return { quote, bgIndex };
  } catch (error) {
    console.warn("Could not read the last poster:", error);
    return null;
  }
}

export async function saveLastPoster(quote, bgIndex) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ quote, bgIndex }));
  } catch (error) {
    console.warn("Could not save the last poster:", error);
  }
}
