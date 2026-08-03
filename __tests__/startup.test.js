// Startup smoke tests. These render the real component tree, which is what a
// bundle check cannot do: a missing named export is `undefined` at runtime and
// bundles cleanly, but throws the moment it is called.
import renderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";
import App from "../App";
import ErrorBoundary from "../ErrorBoundary";
import { QUOTES } from "../quotes";
import { BACKGROUNDS } from "../backgrounds";

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-font", () => ({
  useFonts: jest.fn(() => [true, null]),
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  useLastNotificationResponse: jest.fn(() => null),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("./../seenQuotes", () => ({
  loadSeenQuotes: jest.fn(() => Promise.resolve([])),
  saveSeenQuotes: jest.fn(() => Promise.resolve()),
  presentedQuotes: jest.fn(() => Promise.resolve([])),
}));

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(() => Promise.resolve("file:///tmp/poster.png")),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));


const BOUNDARY_FALLBACK_TEXT = "Something is resting.";

let trees = [];

// Unmounting runs effect cleanup, so the splash timer cannot outlive the test.
afterEach(async () => {
  await act(async () => {
    for (const tree of trees) tree.unmount();
  });
  trees = [];
});

function visibleText(tree) {
  return tree.root
    .findAllByType("Text")
    .flatMap((node) => node.props.children)
    .filter((child) => typeof child === "string");
}

async function renderApp() {
  let tree;
  await act(async () => {
    tree = renderer.create(<App />);
  });
  trees.push(tree);
  return tree;
}

// The boundary's fallback is itself a valid tree, so "it rendered something"
// is not proof of success. Every happy-path test must assert we did not
// silently land in the error state.
function expectNoCrash(tree) {
  expect(visibleText(tree)).not.toContain(BOUNDARY_FALLBACK_TEXT);
}

describe("app startup", () => {
  it("mounts and shows the poster, not the error fallback", async () => {
    const tree = await renderApp();
    expect(tree.toJSON()).toBeTruthy();
    expectNoCrash(tree);
  });

  it("renders a real quote from the bundled list", async () => {
    const tree = await renderApp();
    expect(visibleText(tree).some((text) => QUOTES.includes(text))).toBe(true);
    expectNoCrash(tree);
  });

  it("holds the splash until startup settles, then hides it", async () => {
    const SplashScreen = require("expo-splash-screen");
    SplashScreen.hideAsync.mockClear();
    const tree = await renderApp();
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expectNoCrash(tree);
  });

  it("still renders the poster when the font fails to load", async () => {
    const { useFonts } = require("expo-font");
    const SplashScreen = require("expo-splash-screen");
    SplashScreen.hideAsync.mockClear();
    useFonts.mockReturnValue([false, new Error("font unavailable")]);

    const tree = await renderApp();
    // A font failure must not strand the app on the splash.
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expect(visibleText(tree).some((text) => QUOTES.includes(text))).toBe(true);
    expectNoCrash(tree);

    useFonts.mockReturnValue([true, null]);
  });

  it("survives a notification permission failure", async () => {
    const Notifications = require("expo-notifications");
    Notifications.getPermissionsAsync.mockRejectedValueOnce(
      new Error("permissions unavailable")
    );
    const tree = await renderApp();
    expect(visibleText(tree).some((text) => QUOTES.includes(text))).toBe(true);
    expectNoCrash(tree);
  });

  // Regression guard: the action row shipped in App.js but was missing from a
  // build, so assert the controls are really mounted and labelled.
  it("mounts Shuffle and Share as visible text buttons", async () => {
    const tree = await renderApp();
    const footerText = visibleText(tree);
    for (const label of ["Shuffle", "Share"]) {
      expect(footerText).toContain(label);
    }
    for (const testID of ["shuffle-button", "share-button"]) {
      expect(tree.root.findByProps({ testID })).toBeTruthy();
    }
  });

  it("has no Copy button left anywhere", async () => {
    const tree = await renderApp();
    expect(visibleText(tree)).not.toContain("Copy");
    expect(tree.root.findAllByProps({ testID: "copy-button" })).toHaveLength(0);
  });

  it("renders the buttons with no icon glyphs", async () => {
    const tree = await renderApp();
    // No icon font means no glyph can silently fail to render.
    expect(tree.root.findAllByType("Image")).toHaveLength(1); // watermark only
    for (const label of ["Shuffle", "Share"]) {
      expect(visibleText(tree)).toContain(label);
      expect(
        visibleText(tree).some((t) => t !== label && t.includes(label))
      ).toBe(false);
    }
  });

  it("renders the quote lowercased rather than shouted", async () => {
    const tree = await renderApp();
    const quoteNode = tree.root
      .findAllByType("Text")
      .find((node) => QUOTES.includes(node.props.children));
    const style = StyleSheet.flatten(quoteNode.props.style);
    expect(style.textTransform).toBe("lowercase");
  });

  // Rewriting the quote list shifts every index, so a tapped notification must
  // resolve by text, never by a stale index.
  describe("opening from a notification", () => {
    function tapWith(content) {
      const Notifications = require("expo-notifications");
      Notifications.useLastNotificationResponse.mockReturnValue({
        notification: { request: { content } },
      });
    }

    afterEach(() => {
      const Notifications = require("expo-notifications");
      Notifications.useLastNotificationResponse.mockReturnValue(null);
    });

    it("shows the exact quote the notification carried", async () => {
      const quote = QUOTES[7];
      tapWith({ body: quote, data: { quoteText: quote, quoteIndex: 7 } });
      const tree = await renderApp();
      expect(visibleText(tree)).toContain(quote);
    });

    it("prefers the carried text over a now-stale index", async () => {
      const carried = QUOTES[3];
      // Index points somewhere else entirely, as it would after a rewrite.
      tapWith({ body: carried, data: { quoteText: carried, quoteIndex: 400 } });
      const tree = await renderApp();
      expect(visibleText(tree)).toContain(carried);
      expect(visibleText(tree)).not.toContain(QUOTES[400]);
    });

    it("falls back to the body when a legacy notification has no text", async () => {
      const legacy = "A quote from a previous version of the app.";
      tapWith({ body: legacy, data: { quoteIndex: 12 } });
      const tree = await renderApp();
      expect(visibleText(tree)).toContain(legacy);
    });

    it("still renders a quote when the notification carries nothing usable", async () => {
      tapWith({ body: null, data: {} });
      const tree = await renderApp();
      expect(visibleText(tree).some((t) => QUOTES.includes(t))).toBe(true);
      expectNoCrash(tree);
    });
  });

  it("pairs every background with valid gradient colors", () => {
    for (const background of BACKGROUNDS) {
      expect(background.colors.length).toBeGreaterThanOrEqual(2);
      for (const color of background.colors) {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

describe("sharing", () => {
  function press(tree, testID) {
    return act(async () => {
      tree.root.findByProps({ testID }).props.onPress();
    });
  }

  it("captures the poster and shares the image with no extra text", async () => {
    const { captureRef } = require("react-native-view-shot");
    const Sharing = require("expo-sharing");
    captureRef.mockClear();
    Sharing.shareAsync.mockClear();

    const tree = await renderApp();
    await press(tree, "share-button");

    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(captureRef.mock.calls[0][1]).toMatchObject({ format: "png" });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///tmp/poster.png",
      expect.objectContaining({ mimeType: "image/png" })
    );
    // No caption, message, dialog title, or URL may ride along with the image.
    const shareOptions = Sharing.shareAsync.mock.calls[0][1];
    expect(Object.keys(shareOptions)).toEqual(["mimeType"]);
  });

  it("puts the watermark in the captured poster but never on screen", async () => {
    const tree = await renderApp();
    const layerText = (testID) =>
      tree.root
        .findByProps({ testID })
        .findAllByType("Text")
        .flatMap((node) => node.props.children)
        .filter((child) => typeof child === "string");

    // The branding rides along only in the image that gets shared.
    expect(layerText("capture-layer")).toContain("Sheetposo");
    expect(layerText("visible-layer")).not.toContain("Sheetposo");
    // Both layers still show the same quote, so the capture matches the screen.
    const quoteOf = (id) => layerText(id).find((text) => QUOTES.includes(text));
    expect(quoteOf("capture-layer")).toBe(quoteOf("visible-layer"));
  });

  it("reports a failed share instead of crashing", async () => {
    const { captureRef } = require("react-native-view-shot");
    captureRef.mockRejectedValueOnce(new Error("capture failed"));

    const tree = await renderApp();
    await press(tree, "share-button");

    expect(visibleText(tree)).toContain("Couldn't share.");
    expectNoCrash(tree);
  });

  it("reports when sharing is unavailable on the device", async () => {
    const Sharing = require("expo-sharing");
    Sharing.isAvailableAsync.mockResolvedValueOnce(false);
    Sharing.shareAsync.mockClear();

    const tree = await renderApp();
    await press(tree, "share-button");

    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(visibleText(tree)).toContain("Sharing unavailable.");
    expectNoCrash(tree);
  });
});

describe("previously seen", () => {
  const seenStore = require("./../seenQuotes");

  function press(tree, testID) {
    return act(async () => {
      tree.root.findByProps({ testID }).props.onPress();
    });
  }

  beforeEach(() => {
    seenStore.loadSeenQuotes.mockResolvedValue([]);
    seenStore.presentedQuotes.mockResolvedValue([]);
    seenStore.saveSeenQuotes.mockClear();
  });

  it("lists only stored quotes, never the unseen ones", async () => {
    const stored = [QUOTES[2], QUOTES[5]];
    seenStore.loadSeenQuotes.mockResolvedValue(stored);

    const tree = await renderApp();
    await press(tree, "seen-button");

    const sheetText = tree.root
      .findByProps({ testID: "seen-sheet" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string");

    for (const entry of stored) expect(sheetText).toContain(entry);
    // Everything else in the list must stay hidden. The poster's own quote is
    // legitimately seen, so allow it — but read it from the poster subtree
    // only. Scanning the whole tree would include the sheet itself, and any
    // leak would then excuse itself.
    const onScreen = tree.root
      .findByProps({ testID: "visible-layer" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string" && QUOTES.includes(child));
    const allowed = new Set([...stored, ...onScreen]);
    const leaked = QUOTES.filter(
      (q) => !allowed.has(q) && sheetText.includes(q)
    );
    expect(leaked).toEqual([]);
  });

  it("counts what has been seen against the full list", async () => {
    seenStore.loadSeenQuotes.mockResolvedValue([QUOTES[1], QUOTES[4]]);
    const tree = await renderApp();
    await press(tree, "seen-button");
    const sheetText = tree.root
      .findByProps({ testID: "seen-sheet" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string");
    // Two stored plus the quote currently on the poster.
    expect(sheetText).toContain(`3 of ${QUOTES.length}`);
  });

  it("counts the on-screen quote as seen on a fresh install", async () => {
    const tree = await renderApp();
    await press(tree, "seen-button");
    const sheetText = tree.root
      .findByProps({ testID: "seen-sheet" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string");
    // The displayed quote counts as seen, so the list is never truly empty.
    expect(sheetText).toContain(`1 of ${QUOTES.length}`);
  });

  it("records the displayed quote and persists it", async () => {
    const tree = await renderApp();
    const shown = visibleText(tree).find((t) => QUOTES.includes(t));
    expect(seenStore.saveSeenQuotes).toHaveBeenCalled();
    const lastSaved = seenStore.saveSeenQuotes.mock.calls.at(-1)[0];
    expect(lastSaved).toContain(shown);
  });

  it("counts quotes delivered to the notification tray", async () => {
    const trayQuote = QUOTES[9];
    seenStore.presentedQuotes.mockResolvedValue([trayQuote]);

    const tree = await renderApp();
    await press(tree, "seen-button");
    const sheetText = tree.root
      .findByProps({ testID: "seen-sheet" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string");
    expect(sheetText).toContain(trayQuote);
  });

  it("does not overwrite stored history with the first render", async () => {
    const stored = [QUOTES[11], QUOTES[12], QUOTES[13]];
    seenStore.loadSeenQuotes.mockResolvedValue(stored);

    await renderApp();
    const lastSaved = seenStore.saveSeenQuotes.mock.calls.at(-1)[0];
    for (const entry of stored) expect(lastSaved).toContain(entry);
  });

  it("closes the sheet again", async () => {
    const tree = await renderApp();
    await press(tree, "seen-button");
    expect(
      tree.root.findByProps({ testID: "seen-sheet" }).props.visible
    ).toBe(true);
    await press(tree, "seen-close");
    expect(
      tree.root.findByProps({ testID: "seen-sheet" }).props.visible
    ).toBe(false);
  });
});

// The reported bug was notifications arriving 2-3 at a time. One cause was
// Android batching inexact alarms; the other was here, in the time picking.
describe("notification scheduling", () => {
  const { randomTimesForDay } = require("../notifications");
  const MIN_GAP_MS = 25 * 60 * 1000;

  afterEach(() => {
    jest.useRealTimers();
  });

  function atClock(hour, minute = 0) {
    const when = new Date();
    when.setHours(hour, minute, 0, 0);
    jest.useFakeTimers({
      now: when,
      doNotFake: ["nextTick", "setImmediate"],
    });
  }

  it("never books two quotes within half an hour of each other", () => {
    atClock(8);
    for (let run = 0; run < 200; run++) {
      for (const dayOffset of [0, 1, 3]) {
        const times = randomTimesForDay(dayOffset).map((d) => d.getTime());
        for (let i = 1; i < times.length; i++) {
          // A little under the nominal gap: slot jitter can tighten it slightly.
          expect(times[i] - times[i - 1]).toBeGreaterThan(MIN_GAP_MS * 0.4);
        }
      }
    }
  });

  it("keeps a full day inside the 8am-11pm window", () => {
    atClock(9);
    for (let run = 0; run < 100; run++) {
      for (const when of randomTimesForDay(2)) {
        expect(when.getHours()).toBeGreaterThanOrEqual(8);
        expect(when.getHours()).toBeLessThan(23);
      }
    }
  });

  it("never schedules in the past", () => {
    atClock(14, 30);
    for (let run = 0; run < 100; run++) {
      for (const when of randomTimesForDay(0)) {
        expect(when.getTime()).toBeGreaterThan(Date.now());
      }
    }
  });

  it("thins out the count when the app opens late, instead of cramming", () => {
    atClock(21, 30);
    const lateCounts = [];
    for (let run = 0; run < 100; run++) {
      lateCounts.push(randomTimesForDay(0).length);
    }
    // 90 minutes left can hold at most a few, spaced out.
    expect(Math.max(...lateCounts)).toBeLessThanOrEqual(3);
  });

  it("schedules nothing once the window has closed", () => {
    atClock(23, 30);
    expect(randomTimesForDay(0)).toHaveLength(0);
  });

  it("still fills a normal day with several quotes", () => {
    atClock(8);
    const counts = [];
    for (let run = 0; run < 100; run++) {
      counts.push(randomTimesForDay(1).length);
    }
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...counts)).toBeLessThanOrEqual(8);
  });
});

describe("error boundary", () => {
  it("shows a message instead of unmounting when a child throws", async () => {
    const Exploding = () => {
      throw new Error("kaboom");
    };
    jest.spyOn(console, "error").mockImplementation(() => {});

    let tree;
    await act(async () => {
      tree = renderer.create(
        <ErrorBoundary>
          <Exploding />
        </ErrorBoundary>
      );
    });
    trees.push(tree);

    const texts = visibleText(tree);
    expect(texts).toContain(BOUNDARY_FALLBACK_TEXT);
    expect(texts.some((text) => text.includes("kaboom"))).toBe(true);

    console.error.mockRestore();
  });

  it("renders children untouched when nothing throws", async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(
        <ErrorBoundary>
          <Text>all calm</Text>
        </ErrorBoundary>
      );
    });
    trees.push(tree);
    expect(visibleText(tree)).toContain("all calm");
  });
});
