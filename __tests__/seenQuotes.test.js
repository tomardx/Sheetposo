// Exercises the real seenQuotes module against an in-memory AsyncStorage.
// The startup tests mock this module out, so without these the delivery
// tracking, the part that decides whether an untapped notification counts,
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

const AsyncStorage = require("@react-native-async-storage/async-storage");
const { QUOTES, formatQuote } = require("../quotes");

// The history keeps only quotes the app still ships, so these have to be real
// ones. Named by role rather than by content so the tests stay readable.
const [A, B, C, D] = QUOTES;

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
    await setPendingDeliveries([{ text: A, at: now - MINUTE }]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen).toContain(A);
    expect(await loadSeenQuotes()).toContain(A);
  });

  it("leaves quotes that have not fired yet alone", async () => {
    const now = Date.now();
    await setPendingDeliveries([{ text: A, at: now + MINUTE }]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen).not.toContain(A);
  });

  it("splits a mixed schedule at the current moment", async () => {
    const now = Date.now();
    await setPendingDeliveries([
      { text: A, at: now - 2 * MINUTE },
      { text: B, at: now - MINUTE },
      { text: C, at: now + MINUTE },
    ]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen).toEqual([A, B]);
  });

  it("keeps the future entries pending so a later sweep still finds them", async () => {
    const now = Date.now();
    await setPendingDeliveries([
      { text: A, at: now - MINUTE },
      { text: B, at: now + MINUTE },
    ]);

    await syncDeliveredIntoSeen(now);
    // Time moves on; the second notification fires.
    const seen = await syncDeliveredIntoSeen(now + 2 * MINUTE);

    expect(seen).toEqual([A, B]);
  });

  it("preserves history that was already stored", async () => {
    const now = Date.now();
    await saveSeenQuotes([A]);
    await setPendingDeliveries([{ text: B, at: now - MINUTE }]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen).toEqual([A, B]);
  });

  it("does not record the same quote twice", async () => {
    const now = Date.now();
    await saveSeenQuotes([A]);
    await setPendingDeliveries([
      { text: A, at: now - 2 * MINUTE },
      { text: A, at: now - MINUTE },
    ]);

    const seen = await syncDeliveredIntoSeen(now);

    expect(seen.filter((entry) => entry === A)).toHaveLength(1);
  });

  it("clears delivered entries so they are not swept again", async () => {
    const now = Date.now();
    await setPendingDeliveries([{ text: A, at: now - MINUTE }]);
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

// A tester's history reached "767 of 766". Quotes deleted with the legacy pack
// were still counted, and the tray fallback stores the capitalised body rather
// than the raw text, so a quote could be held twice under two spellings.
describe("the history only counts quotes the app still has", () => {
  const DELETED = "a quote from a pack that no longer ships";

  it("drops entries that match no live quote", async () => {
    await saveSeenQuotes([A, DELETED, B]);
    expect(await loadSeenQuotes()).toEqual([A, B]);
  });

  it("can never exceed the size of the quote list", async () => {
    // The exact shape of the bug: every live quote, plus junk on top.
    await saveSeenQuotes([...QUOTES, DELETED, "another ghost"]);
    const seen = await loadSeenQuotes();
    expect(seen).toHaveLength(QUOTES.length);
  });

  it("prunes the stored history rather than filtering it on every read", async () => {
    await setPendingDeliveries([]);
    // Written past saveSeenQuotes, the way an older build would have left it.
    await AsyncStorage.setItem(
      "sheetposo:seenQuotes",
      JSON.stringify([A, DELETED])
    );
    await loadSeenQuotes();
    const stored = JSON.parse(
      await AsyncStorage.getItem("sheetposo:seenQuotes")
    );
    expect(stored).toEqual([A]);
  });

  it("treats the displayed form and the stored form as one quote", async () => {
    // Notifications carry the raw text, but the tray fallback reads the body,
    // which has been capitalised for display.
    await saveSeenQuotes([A, formatQuote(A)]);
    expect(await loadSeenQuotes()).toEqual([A]);
  });

  it("resolves a display-form delivery onto the quote it came from", async () => {
    const now = Date.now();
    await saveSeenQuotes([A]);
    await setPendingDeliveries([{ text: formatQuote(A), at: now - MINUTE }]);
    expect(await syncDeliveredIntoSeen(now)).toEqual([A]);
  });

  it("keeps first-seen order while pruning", async () => {
    await saveSeenQuotes([C, DELETED, A, B]);
    expect(await loadSeenQuotes()).toEqual([C, A, B]);
  });
});
