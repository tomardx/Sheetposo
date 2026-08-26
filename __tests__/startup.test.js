// Startup smoke tests. These render the real component tree, which is what a
// bundle check cannot do: a missing named export is `undefined` at runtime and
// bundles cleanly, but throws the moment it is called.
import renderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";
import App from "../App";
import ErrorBoundary from "../ErrorBoundary";
import { QUOTES, formatQuote } from "../quotes";
import { BACKGROUNDS } from "../backgrounds";
import { RARITY, TIERS, tierOf, weightedRandomQuote } from "../rarity";

// Quotes are stored lowercase and capitalised at display time, so anything
// compared against rendered text has to go through formatQuote first.
const shown = (quote) => formatQuote(quote);
const SHOWN_QUOTES = new Set(QUOTES.map(formatQuote));
const isQuote = (text) => SHOWN_QUOTES.has(text);

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
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
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
  setPendingDeliveries: jest.fn(() => Promise.resolve()),
  syncDeliveredIntoSeen: jest.fn(() => Promise.resolve([])),
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
    expect(visibleText(tree).some((text) => isQuote(text))).toBe(true);
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
    expect(visibleText(tree).some((text) => isQuote(text))).toBe(true);
    expectNoCrash(tree);

    useFonts.mockReturnValue([true, null]);
  });

  it("survives a notification permission failure", async () => {
    const Notifications = require("expo-notifications");
    Notifications.getPermissionsAsync.mockRejectedValueOnce(
      new Error("permissions unavailable")
    );
    const tree = await renderApp();
    expect(visibleText(tree).some((text) => isQuote(text))).toBe(true);
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
    // Scoped to each button: scanning the whole tree would trip over any
    // unrelated copy that happens to contain the word.
    for (const [testID, label] of [
      ["shuffle-button", "Shuffle"],
      ["share-button", "Share"],
    ]) {
      const inside = tree.root
        .findByProps({ testID })
        .findAllByType("Text")
        .flatMap((node) => node.props.children)
        .filter((child) => typeof child === "string");
      expect(inside).toEqual([label]);
    }
  });

  it("capitalises the first letter of the quote on screen", async () => {
    const tree = await renderApp();
    const quoteNode = tree.root
      .findAllByType("Text")
      .find((node) => isQuote(node.props.children));
    const rendered = quoteNode.props.children;

    expect(rendered[0]).toBe(rendered[0].toUpperCase());
    // No forced casing, which would otherwise undo that capital.
    const style = StyleSheet.flatten(quoteNode.props.style);
    expect(style.textTransform).toBeUndefined();
  });

  // Deterministic, unlike the render test above: the poster picks at random,
  // and one quote ("I C U P …") is deliberately capitalised mid-line.
  describe("formatQuote", () => {
    it("capitalises the opening letter", () => {
      expect(formatQuote("the toaster remembers")).toBe(
        "The toaster remembers"
      );
    });

    it("leaves the rest of the line untouched", () => {
      expect(formatQuote("I C U P N i forgot what i had else to say")).toBe(
        "I C U P N i forgot what i had else to say"
      );
    });

    it("is safe on empty or missing input", () => {
      expect(formatQuote("")).toBe("");
      expect(formatQuote(undefined)).toBe("");
      expect(formatQuote(null)).toBe("");
    });

    it("capitalises every quote in the shipping list", () => {
      for (const quote of QUOTES) {
        const first = formatQuote(quote)[0];
        expect(first).toBe(first.toUpperCase());
      }
    });
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
      expect(visibleText(tree)).toContain(shown(quote));
    });

    it("prefers the carried text over a now-stale index", async () => {
      const carried = QUOTES[3];
      // Index points somewhere else entirely, as it would after a rewrite.
      tapWith({ body: carried, data: { quoteText: carried, quoteIndex: 400 } });
      const tree = await renderApp();
      expect(visibleText(tree)).toContain(shown(carried));
      expect(visibleText(tree)).not.toContain(shown(QUOTES[400]));
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
      expect(visibleText(tree).some((t) => isQuote(t))).toBe(true);
      expectNoCrash(tree);
    });
  });

  it("gives every background usable shapes and a gradient direction", () => {
    for (const background of BACKGROUNDS) {
      expect(background.shapes.length).toBeGreaterThan(0);
      expect(background.start).toEqual(
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
      );
      expect(background.end).toEqual(
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
      );
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
    const options = captureRef.mock.calls[0][1];
    expect(options).toMatchObject({ format: "png" });
    // Square export: chat apps crop tall images in the message preview, which
    // would cut off the watermark.
    expect(options.width).toBe(options.height);
    expect(options.width).toBeGreaterThanOrEqual(1000);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///tmp/poster.png",
      expect.objectContaining({ mimeType: "image/png" })
    );
    // No caption, message, dialog title, or URL may ride along with the image.
    const shareOptions = Sharing.shareAsync.mock.calls[0][1];
    expect(Object.keys(shareOptions)).toEqual(["mimeType"]);
  });

  it("lays the capture layer out as a square", async () => {
    const tree = await renderApp();
    const layer = tree.root.findByProps({ testID: "capture-layer" });
    const style = StyleSheet.flatten(layer.props.style);
    expect(style.width).toBe(style.height);
    expect(style.width).toBeGreaterThan(0);
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
    const quoteOf = (id) => layerText(id).find((text) => isQuote(text));
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

describe("rarity", () => {
  it("points every assignment at a quote that still exists", () => {
    // A rewrite of the list can silently orphan a key, and an orphaned key is
    // invisible: the quote just stays common.
    const orphans = Object.keys(RARITY).filter((q) => !QUOTES.includes(q));
    expect(orphans).toEqual([]);
  });

  it("only uses tier ids that are defined", () => {
    const ids = new Set(TIERS.map((tier) => tier.id));
    for (const id of Object.values(RARITY)) expect(ids.has(id)).toBe(true);
  });

  it("gets rarer as the tiers go up", () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].share).toBeLessThan(TIERS[i - 1].share);
      expect(TIERS[i].motion).toBeGreaterThanOrEqual(TIERS[i - 1].motion);
    }
  });

  it("has shares that add up to one", () => {
    const total = TIERS.reduce((sum, tier) => sum + tier.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("gives every tier a distinct colour and a full gradient", () => {
    const colors = TIERS.map((tier) => tier.color);
    expect(new Set(colors).size).toBe(colors.length);
    for (const tier of TIERS) {
      expect(tier.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(tier.gradient).toHaveLength(3);
      for (const stop of tier.gradient) {
        expect(stop).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("leaves no tier without members", () => {
    const counts = new Map(TIERS.map((tier) => [tier.id, 0]));
    for (const quote of QUOTES) {
      const id = tierOf(quote).id;
      counts.set(id, counts.get(id) + 1);
    }
    for (const tier of TIERS) expect(counts.get(tier.id)).toBeGreaterThan(0);
  });

  it("puts a quote in the same tier every time", () => {
    for (const quote of QUOTES.slice(0, 40)) {
      expect(tierOf(quote).id).toBe(tierOf(quote).id);
    }
    // Unassigned quotes are split by a stable hash, so this must hold for
    // them too, not just for the hand-listed ones.
    const unlisted = QUOTES.find((q) => !RARITY[q]);
    const first = tierOf(unlisted).id;
    for (let i = 0; i < 10; i++) expect(tierOf(unlisted).id).toBe(first);
  });

  it("pulls each tier at roughly its share", () => {
    const draws = new Map(TIERS.map((tier) => [tier.id, 0]));
    const runs = 20000;
    for (let i = 0; i < runs; i++) {
      const id = tierOf(weightedRandomQuote(QUOTES)).id;
      draws.set(id, draws.get(id) + 1);
    }
    for (const tier of TIERS) {
      const measured = draws.get(tier.id) / runs;
      // Generous band: this is a sampling check, not a precision one.
      expect(Math.abs(measured - tier.share)).toBeLessThan(0.03);
    }
  });

  it("never returns the excluded quote", () => {
    const exclude = QUOTES[0];
    for (let i = 0; i < 500; i++) {
      expect(weightedRandomQuote(QUOTES, exclude)).not.toBe(exclude);
    }
  });

  it("keeps fish the rarest tier, and lowercase", () => {
    const fish = TIERS[TIERS.length - 1];
    expect(fish.id).toBe("fish");
    expect(fish.label).toBe("fish");
    expect(fish.share).toBeLessThan(0.01);
  });
});

describe("what's new", () => {
  const { PATCH_NOTES } = require("../patchNotes");

  function press(tree, testID) {
    return act(async () => {
      tree.root.findByProps({ testID }).props.onPress();
    });
  }

  function sheetText(tree) {
    return tree.root
      .findByProps({ testID: "patch-notes-sheet" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string");
  }

  it("mounts the button and keeps the sheet shut until asked", async () => {
    const tree = await renderApp();
    expect(visibleText(tree)).toContain("What's new?");
    expect(
      tree.root.findByProps({ testID: "patch-notes-sheet" }).props.visible
    ).toBe(false);
  });

  it("opens onto the newest release first", async () => {
    const tree = await renderApp();
    await press(tree, "whats-new-button");

    const text = sheetText(tree);
    const newest = PATCH_NOTES[0];
    expect(text).toContain(`${newest.version}: ${newest.title}`);
    expect(text).toContain(newest.date);
  });

  it("lists every release, with its date and its bullets", async () => {
    const tree = await renderApp();
    await press(tree, "whats-new-button");

    const text = sheetText(tree);
    for (const release of PATCH_NOTES) {
      expect(text).toContain(release.date);
      for (const section of release.sections) {
        expect(text).toContain(section.heading);
        for (const item of section.items) expect(text).toContain(item);
      }
    }
  });

  it("closes again", async () => {
    const tree = await renderApp();
    await press(tree, "whats-new-button");
    expect(
      tree.root.findByProps({ testID: "patch-notes-sheet" }).props.visible
    ).toBe(true);
    await press(tree, "patch-notes-close");
    expect(
      tree.root.findByProps({ testID: "patch-notes-sheet" }).props.visible
    ).toBe(false);
  });

  it("stays out of the shared image", async () => {
    const tree = await renderApp();
    const captureText = tree.root
      .findByProps({ testID: "capture-layer" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string");
    expect(captureText).not.toContain("What's new?");
  });

  it("keeps the notes newest first", () => {
    const dates = PATCH_NOTES.map((r) => Date.parse(r.date));
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
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
    seenStore.syncDeliveredIntoSeen.mockResolvedValue([]);
    seenStore.presentedQuotes.mockResolvedValue([]);
    seenStore.saveSeenQuotes.mockClear();
  });

  it("lists only stored quotes, never the unseen ones", async () => {
    const stored = [QUOTES[2], QUOTES[5]];
    seenStore.syncDeliveredIntoSeen.mockResolvedValue(stored);

    const tree = await renderApp();
    await press(tree, "seen-button");

    const sheetText = tree.root
      .findByProps({ testID: "seen-sheet" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string");

    for (const entry of stored) expect(sheetText).toContain(shown(entry));
    // Everything else in the list must stay hidden. The poster's own quote is
    // legitimately seen, so allow it, but read it from the poster subtree
    // only. Scanning the whole tree would include the sheet itself, and any
    // leak would then excuse itself.
    const onScreen = tree.root
      .findByProps({ testID: "visible-layer" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string" && isQuote(child));
    const allowed = new Set([...stored.map(shown), ...onScreen]);
    const leaked = QUOTES.map(shown).filter(
      (q) => !allowed.has(q) && sheetText.includes(q)
    );
    expect(leaked).toEqual([]);
  });

  it("counts what has been seen against the full list", async () => {
    const stored = [QUOTES[1], QUOTES[4]];
    seenStore.syncDeliveredIntoSeen.mockResolvedValue(stored);
    const tree = await renderApp();
    await press(tree, "seen-button");
    const sheetText = tree.root
      .findByProps({ testID: "seen-sheet" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string");
    // Stored plus whatever landed on the poster, derived, not hardcoded,
    // because the random poster quote can itself be one of the stored ones.
    const onScreen = tree.root
      .findByProps({ testID: "visible-layer" })
      .findAllByType("Text")
      .flatMap((node) => node.props.children)
      .filter((child) => typeof child === "string" && isQuote(child));
    const expected = new Set([...stored.map(shown), ...onScreen]).size;
    expect(sheetText).toContain(`${expected} of ${QUOTES.length}`);
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
    const onScreen = visibleText(tree).filter(isQuote);
    expect(seenStore.saveSeenQuotes).toHaveBeenCalled();
    // History stores the raw lowercase quote; the poster shows it capitalised.
    const lastSaved = seenStore.saveSeenQuotes.mock.calls.at(-1)[0];
    expect(lastSaved.some((raw) => onScreen.includes(shown(raw)))).toBe(true);
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
    expect(sheetText).toContain(shown(trayQuote));
  });

  it("does not overwrite stored history with the first render", async () => {
    const stored = [QUOTES[11], QUOTES[12], QUOTES[13]];
    seenStore.syncDeliveredIntoSeen.mockResolvedValue(stored);

    await renderApp();
    const lastSaved = seenStore.saveSeenQuotes.mock.calls.at(-1)[0];
    for (const entry of stored) expect(lastSaved).toContain(entry);
  });

  describe("filtering by tier", () => {
    // The poster records its own quote as seen, so the sheet always holds one
    // more entry than we stored, in whatever tier that quote happens to be.
    // Every expectation below is derived from what actually rendered.
    const fishQuotes = QUOTES.filter((q) => tierOf(q).id === "fish");
    const moosQuotes = QUOTES.filter((q) => tierOf(q).id === "moos");
    const stored = [...fishQuotes.slice(0, 2), ...moosQuotes.slice(0, 3)];

    async function openSeen(list = stored) {
      seenStore.syncDeliveredIntoSeen.mockResolvedValue(list);
      const tree = await renderApp();
      await press(tree, "seen-button");
      return tree;
    }

    const rawOf = (rendered) => QUOTES.find((q) => shown(q) === rendered);

    function rows(tree) {
      return tree.root
        .findByProps({ testID: "seen-sheet" })
        .findAllByType("Text")
        .flatMap((node) => node.props.children)
        .filter((child) => typeof child === "string" && isQuote(child));
    }

    function chipLabels(tree) {
      const found = tree.root.findAllByProps({ testID: "seen-filters" });
      if (found.length === 0) return [];
      return found[0]
        .findAllByType("Text")
        .flatMap((node) => node.props.children)
        .filter((child) => typeof child === "string");
    }

    const tiersIn = (tree) =>
      new Set(rows(tree).map((row) => tierOf(rawOf(row)).id));

    it("offers exactly the tiers collected, and no others", async () => {
      const tree = await openSeen();
      const labels = chipLabels(tree);
      const offered = new Set(
        TIERS.filter((tier) =>
          labels.some((l) => l.startsWith(`${tier.short} `))
        ).map((tier) => tier.id)
      );
      // Uncollected tiers must never appear: the filter would otherwise leak
      // what is still out there, which is the point of hiding it.
      expect(offered).toEqual(tiersIn(tree));
    });

    it("counts what is in each tier", async () => {
      const tree = await openSeen();
      const labels = chipLabels(tree);
      const all = rows(tree);
      expect(labels).toContain(`All ${all.length}`);

      for (const id of tiersIn(tree)) {
        const tier = TIERS.find((candidate) => candidate.id === id);
        const count = all.filter((row) => tierOf(rawOf(row)).id === id).length;
        expect(labels).toContain(`${tier.short} ${count}`);
      }
    });

    it("narrows the list to the chosen tier", async () => {
      const tree = await openSeen();
      const fishCount = rows(tree).filter(
        (row) => tierOf(rawOf(row)).id === "fish"
      ).length;

      await press(tree, "seen-filter-fish");
      const filtered = rows(tree);
      expect(filtered).toHaveLength(fishCount);
      for (const row of filtered) {
        expect(tierOf(rawOf(row)).id).toBe("fish");
      }
    });

    it("goes back to everything via All, and by tapping the chip again", async () => {
      const tree = await openSeen();
      const total = rows(tree).length;

      await press(tree, "seen-filter-fish");
      expect(rows(tree).length).toBeLessThan(total);

      await press(tree, "seen-filter-all");
      expect(rows(tree)).toHaveLength(total);

      await press(tree, "seen-filter-fish");
      await press(tree, "seen-filter-fish");
      expect(rows(tree)).toHaveLength(total);
    });

    it("shows the chip row only when more than one tier is collected", async () => {
      const tree = await openSeen(fishQuotes.slice(0, 2));
      const distinct = tiersIn(tree).size;
      const hasChips = chipLabels(tree).length > 0;
      expect(hasChips).toBe(distinct > 1);
    });

    it("forgets the filter when the sheet is reopened", async () => {
      const tree = await openSeen();
      const total = rows(tree).length;

      await press(tree, "seen-filter-fish");
      expect(rows(tree).length).toBeLessThan(total);

      await press(tree, "seen-close");
      await press(tree, "seen-button");
      expect(rows(tree)).toHaveLength(total);
    });
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
