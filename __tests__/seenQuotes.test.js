// Exercises the real seenQuotes module against an in-memory AsyncStorage.
// The startup tests mock this module out, so without these the delivery
// tracking — the part that decides whether an untapped notification counts —
// would have no coverage at all.
const mockStore = new Map();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key) => Promise.resolve(mockStore.get(key) ?? null)),
  setItem: jest.fn((key, value) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
}));

jest.mock("expo-notifications", () => ({
  getPresentedNotificationsAsync: jest.fn(() => Promise.resolve([])),
}));

const {
  loadSeenQuotes,
  saveSeenQuotes,
  setPendingDeliveries,
  syncDeliveredIntoSeen,
  presentedQuotes,
} = require("../seenQuotes");

const MINUTE = 60 * 1000;

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
});

describe("delivered notifications count as seen", () => {
  it("records a quote once its scheduled time has passed", async () => {
    const now = Date.now();
    await setPendingDeliveries([{ text: "a delivered quote", at: now - MINUTE }]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen).toContain("a delivered quote");
    expect(await loadSeenQuotes()).toContain("a delivered quote");
  });

  it("leaves quotes that have not fired yet alone", async () => {
    const now = Date.now();
    await setPendingDeliveries([{ text: "not yet", at: now + MINUTE }]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen).not.toContain("not yet");
  });

  it("splits a mixed schedule at the current moment", async () => {
    const now = Date.now();
    await setPendingDeliveries([
      { text: "past one", at: now - 2 * MINUTE },
      { text: "past two", at: now - MINUTE },
      { text: "future one", at: now + MINUTE },
    ]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen).toEqual(["past one", "past two"]);
  });

  it("keeps the future entries pending so a later sweep still finds them", async () => {
    const now = Date.now();
    await setPendingDeliveries([
      { text: "early", at: now - MINUTE },
      { text: "late", at: now + MINUTE },
    ]);

    await syncDeliveredIntoSeen(now);
    // Time moves on; the second notification fires.
    const seen = await syncDeliveredIntoSeen(now + 2 * MINUTE);

    expect(seen).toEqual(["early", "late"]);
  });

  it("preserves history that was already stored", async () => {
    const now = Date.now();
    await saveSeenQuotes(["an old favourite"]);
    await setPendingDeliveries([{ text: "brand new", at: now - MINUTE }]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen).toEqual(["an old favourite", "brand new"]);
  });

  it("does not record the same quote twice", async () => {
    const now = Date.now();
    await saveSeenQuotes(["repeat"]);
    await setPendingDeliveries([
      { text: "repeat", at: now - 2 * MINUTE },
      { text: "repeat", at: now - MINUTE },
    ]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen.filter((entry) => entry === "repeat")).toHaveLength(1);
  });

  it("clears delivered entries so they are not swept again", async () => {
    const now = Date.now();
    await setPendingDeliveries([{ text: "once", at: now - MINUTE }]);
    await syncDeliveredIntoSeen(now);

    // Wipe the history but leave the log; nothing should come back.
    await saveSeenQuotes([]);
    const seen = await syncDeliveredIntoSeen(now);

    expect(seen).toEqual([]);
  });

  it("survives a corrupted delivery log", async () => {
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    AsyncStorage.getItem.mockImplementationOnce(() => Promise.resolve("{ not json"));

    await expect(syncDeliveredIntoSeen(Date.now())).resolves.toEqual([]);
  });
});

describe("notifications still in the tray", () => {
  it("prefers the carried quote text over the notification body", async () => {
    const Notifications = require("expo-notifications");
    Notifications.getPresentedNotificationsAsync.mockResolvedValueOnce([
      { request: { content: { body: "the body", data: { quoteText: "the real quote" } } } },
      { request: { content: { body: "body only", data: {} } } },
    ]);

    expect(await presentedQuotes()).toEqual(["the real quote", "body only"]);
  });

  it("returns nothing when the tray cannot be read", async () => {
    const Notifications = require("expo-notifications");
    Notifications.getPresentedNotificationsAsync.mockRejectedValueOnce(
      new Error("unavailable")
    );

    expect(await presentedQuotes()).toEqual([]);
  });
});
