import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { QUOTES, QUOTES_VERSION, formatQuote } from "./quotes";
import { setPendingDeliveries, syncDeliveredIntoSeen } from "./seenQuotes";

const LAST_SCHEDULED_KEY = "sheetposo:lastScheduledDay";

// Android locks a channel's sound and importance at creation time and ignores
// later edits, so changing either needs a new channel id. Bump this suffix
// whenever the channel config below changes.
const CHANNEL_ID = "sheetposo-quotes-v2";
const RETIRED_CHANNEL_IDS = ["sheetposo-quotes"];
const SOUND_FILE = "bleep.wav";

// Notifications fire between 8:00 and 23:00.
const WINDOW_START_HOUR = 8;
const WINDOW_END_HOUR = 23;
const MIN_PER_DAY = 3;
const MAX_PER_DAY = 8;
// Never let two notifications land on top of each other.
const MIN_GAP_MS = 25 * 60 * 1000;
// Schedule a week out, so quotes keep arriving even if the app is never
// opened. Reopening the app on a new day re-rolls the whole schedule.
const DAYS_AHEAD = 6;

export function configureNotificationHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  // Drop channels from earlier builds so stale ones don't linger in settings.
  for (const retired of RETIRED_CHANNEL_IDS) {
    await Notifications.deleteNotificationChannelAsync(retired).catch(() => {});
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Daily Reflection",
    // HIGH pops a heads-up banner; DEFAULT only lands silently in the tray.
    importance: Notifications.AndroidImportance.HIGH,
    sound: SOUND_FILE,
    vibrationPattern: [0, 120, 60, 120],
    enableVibrate: true,
  });
}

export async function requestNotificationPermission() {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

function dayWindow(dayOffset) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() + dayOffset);
  start.setHours(WINDOW_START_HOUR, 0, 0, 0);
  const end = new Date(now);
  end.setDate(now.getDate() + dayOffset);
  end.setHours(WINDOW_END_HOUR, 0, 0, 0);
  // Today only gets whatever is left of the window, plus a short lead so
  // nothing is booked in the past while we are still scheduling.
  const earliest =
    dayOffset === 0
      ? new Date(Math.max(start.getTime(), now.getTime() + 5 * 60 * 1000))
      : start;
  return { start, end, earliest };
}

// Picks times by splitting the window into equal slots and jittering within
// each one. Purely random times clustered badly — opening the app late in the
// evening could drop the whole day's quotes into the same half hour.
export function randomTimesForDay(dayOffset) {
  const { start, end, earliest } = dayWindow(dayOffset);
  if (earliest >= end) return [];

  const spanMs = end.getTime() - earliest.getTime();
  const fullSpanMs = end.getTime() - start.getTime();

  let count =
    MIN_PER_DAY + Math.floor(Math.random() * (MAX_PER_DAY - MIN_PER_DAY + 1));
  // Scale a partial day down so a short remaining window isn't crammed full.
  if (spanMs < fullSpanMs) {
    count = Math.round(count * (spanMs / fullSpanMs));
  }
  // And never book more than the window can space out.
  count = Math.min(count, Math.floor(spanMs / MIN_GAP_MS));
  if (count < 1) return [];

  const slotMs = spanMs / count;
  const marginMs = Math.min(slotMs * 0.15, MIN_GAP_MS / 2);
  const jitterMs = Math.max(0, slotMs - 2 * marginMs);

  const times = [];
  for (let i = 0; i < count; i++) {
    const slotStart = earliest.getTime() + i * slotMs;
    times.push(new Date(slotStart + marginMs + Math.random() * jitterMs));
  }
  return times;
}

// Returns what was booked, so the caller can log it and later count the quote
// as seen once its time passes.
async function scheduleQuoteAt(date) {
  const quoteIndex = Math.floor(Math.random() * QUOTES.length);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Daily Reflection",
      body: formatQuote(QUOTES[quoteIndex]),
      // Carry the text itself, not just the index: editing the quote list
      // shifts indexes, and already-scheduled notifications would otherwise
      // open the app on the wrong quote.
      data: {
        quoteText: QUOTES[quoteIndex],
        quoteIndex,
        version: QUOTES_VERSION,
      },
      sound: SOUND_FILE,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: CHANNEL_ID,
    },
  });
  return { text: QUOTES[quoteIndex], at: date.getTime() };
}

// Re-rolls the whole schedule once per calendar day: cancels everything
// pending and books fresh random quotes at random times for the week ahead.
export async function rescheduleIfNeeded() {
  const granted = await requestNotificationPermission();
  if (!granted) return;
  await ensureAndroidChannel();

  // Keyed on the quote version too, so rewriting the list re-rolls the
  // schedule immediately instead of leaving yesterday's quotes queued.
  const today = `${QUOTES_VERSION}:${new Date().toDateString()}`;
  const lastScheduled = await AsyncStorage.getItem(LAST_SCHEDULED_KEY);
  if (lastScheduled === today) return;

  // Bank anything already delivered before wiping the schedule, otherwise
  // those quotes would drop out of the history unrecorded.
  await syncDeliveredIntoSeen();

  await Notifications.cancelAllScheduledNotificationsAsync();
  const booked = [];
  for (let dayOffset = 0; dayOffset <= DAYS_AHEAD; dayOffset++) {
    for (const date of randomTimesForDay(dayOffset)) {
      booked.push(await scheduleQuoteAt(date));
    }
  }
  await setPendingDeliveries(booked);
  await AsyncStorage.setItem(LAST_SCHEDULED_KEY, today);
}
