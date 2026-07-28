// Startup smoke tests. These render the real component tree, which is what a
// bundle check cannot do: a missing named export is `undefined` at runtime and
// bundles cleanly, but throws the moment it is called.
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
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

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(() => Promise.resolve("file:///tmp/poster.png")),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
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
  // build, so assert all three controls are really mounted and labelled.
  it("mounts Shuffle, Share, and Copy as visible text buttons", async () => {
    const tree = await renderApp();
    const footerText = visibleText(tree);
    for (const label of ["Shuffle", "Share", "Copy"]) {
      expect(footerText).toContain(label);
    }
    for (const testID of ["shuffle-button", "share-button", "copy-button"]) {
      expect(tree.root.findByProps({ testID })).toBeTruthy();
    }
  });

  it("renders the buttons with no icon glyphs", async () => {
    const tree = await renderApp();
    // No icon font means no glyph can silently fail to render.
    expect(tree.root.findAllByType("Image")).toHaveLength(1); // watermark only
    const labels = ["Shuffle", "Share", "Copy"];
    for (const label of labels) {
      expect(visibleText(tree)).toContain(label);
      expect(visibleText(tree).some((t) => t !== label && t.includes(label)))
        .toBe(false);
    }
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

  function currentQuote(tree) {
    return visibleText(tree).find((text) => QUOTES.includes(text));
  }

  it("copies only the bare quote text, with no branding or link", async () => {
    const Clipboard = require("expo-clipboard");
    Clipboard.setStringAsync.mockClear();

    const tree = await renderApp();
    const quote = currentQuote(tree);
    await press(tree, "copy-button");

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    const copied = Clipboard.setStringAsync.mock.calls[0][0];
    expect(copied).toBe(quote);
    expect(copied).not.toMatch(/Sheetposo|https?:\/\//i);
  });

  it("confirms the copy with a calm message", async () => {
    const tree = await renderApp();
    await press(tree, "copy-button");
    expect(visibleText(tree)).toContain("Copied.");
  });

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
