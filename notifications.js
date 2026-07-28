import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { QUOTES, QUOTES_VERSION } from "./quotes";

const LAST_SCHEDULED_KEY = "sheetposo:lastScheduledDay";
const CHANNEL_ID = "sheetposo-quotes";

// Notifications fire between 8:00 and 23:00.
const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 23;
const MIN_PER_DAY = 3;
const MAX_PER_DAY = 8;
// Schedule today + the next N days so quotes keep arriving even if the app
// isn't opened daily. Reopening the app re-rolls everything.
const DAYS_AHEAD = 3;

export function configureNotificationHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Daily Reflection",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    enableVibrate: true,
  });
}

export async function requestNotificationPermission() {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

function randomTimesForDay(dayOffset) {
  const count =
    MIN_PER_DAY + Math.floor(Math.random() * (MAX_PER_DAY - MIN_PER_DAY + 1));
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(now.getDate() + dayOffset);
  windowStart.setHours(WINDOW_START_HOUR, 0, 0, 0);
  const windowEnd = new Date(now);
  windowEnd.setDate(now.getDate() + dayOffset);
  windowEnd.setHours(WINDOW_END_HOUR, 0, 0, 0);

  // For today, only use what's left of the window (plus a small lead so
  // nothing is scheduled in the immediate past while we're still setting up).
  const earliest =
    dayOffset === 0
      ? new Date(Math.max(windowStart.getTime(), now.getTime() + 5 * 60 * 1000))
      : windowStart;
  if (earliest >= windowEnd) return [];

  const span = windowEnd.getTime() - earliest.getTime();
  const times = [];
  for (let i = 0; i < count; i++) {
    times.push(new Date(earliest.getTime() + Math.random() * span));
  }
  return times.sort((a, b) => a - b);
}

async function scheduleQuoteAt(date) {
  const quoteIndex = Math.floor(Math.random() * QUOTES.length);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Daily Reflection",
      body: QUOTES[quoteIndex],
      // Carry the text itself, not just the index: editing the quote list
      // shifts indexes, and already-scheduled notifications would otherwise
      // open the app on the wrong quote.
      data: { quoteText: QUOTES[quoteIndex], quoteIndex, version: QUOTES_VERSION },
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: CHANNEL_ID,
    },
  });
}

// Re-rolls the whole schedule once per calendar day: cancels everything
// pending and books fresh random quotes at random times for the next few days.
export async function rescheduleIfNeeded() {
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await ensureAndroidChannel();

  // Keyed on the quote version too, so rewriting the list re-rolls the
  // schedule immediately instead of leaving yesterday's quotes queued.
  const today = `${QUOTES_VERSION}:${new Date().toDateString()}`;
  const lastScheduled = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
  if (lastScheduled === today) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (let dayOffset = 0; dayOffset <= DAYS_AHEAD; dayOffset++) {
    for (const date of randomTimesForDay(dayOffset)) {
      await scheduleQuoteAt(date);
    }
  }
  await AsyncStorage.setItem(LAST_SCHEDULED_KEY, today);
}
