import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
// useFonts comes from expo-font: the @expo-google-fonts subpath exports only
// the font constant, so importing useFonts from it yields undefined.
import { useFonts } from "expo-font";
// Subpath import so Metro bundles only this weight, not all of Poppins.
import { Poppins_500Medium } from "@expo-google-fonts/poppins/500Medium";
import { QUOTES } from "./quotes";
import { BACKGROUNDS, BRAND, randomBackgroundIndex } from "./backgrounds";
import {
  configureNotificationHandling,
  rescheduleIfNeeded,
} from "./notifications";
import ErrorBoundary, { installGlobalErrorHandler } from "./ErrorBoundary";
import {
  loadSeenQuotes,
  presentedQuotes,
  saveSeenQuotes,
} from "./seenQuotes";

// Both are synchronous, JS-only registrations: safe at module scope.
installGlobalErrorHandler();
configureNotificationHandling();

// Hold the splash before any async startup work begins. Never let a failure
// here reject unhandled — a missing splash is not worth crashing over.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Backstop so a stalled font load can never strand the app on the splash.
const SPLASH_TIMEOUT_MS = 5000;
const TOAST_VISIBLE_MS = 1500;
// Exported share image, square. 1080 is what chat apps expect.
const SHARE_IMAGE_PX = 1080;

// Transparent lotus layer, reused as the share watermark.
const LOTUS_MARK = require("./assets/adaptive-icon.png");

// Quotes are held as text, not as an index into QUOTES, so editing the list
// can never make a scheduled notification open the wrong quote.
function randomQuote(exclude) {
  if (QUOTES.length <= 1) return QUOTES[0];
  let next;
  do {
    next = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  } while (next === exclude);
  return next;
}

// Prefer the text the notification actually displayed; fall back to its body,
// then to a legacy index from a notification scheduled by an older build.
function quoteFromNotification(response) {
  const content = response?.notification?.request?.content;
  if (!content) return null;
  if (typeof content.data?.quoteText === "string" && content.data.quoteText) {
    return content.data.quoteText;
  }
  if (typeof content.body === "string" && content.body) return content.body;
  const legacyIndex = content.data?.quoteIndex;
  if (typeof legacyIndex === "number" && QUOTES[legacyIndex]) {
    return QUOTES[legacyIndex];
  }
  return null;
}

function quoteFontSize(quote) {
  if (quote.length < 60) return 34;
  if (quote.length < 100) return 28;
  if (quote.length < 140) return 24;
  return 21;
}

function BackgroundShapes({ shapes }) {
  const { width, height } = useWindowDimensions();
  return shapes.map((shape, i) => (
    <View
      key={i}
      pointerEvents="none"
      style={{
        position: "absolute",
        left: (shape.left / 100) * width,
        top: (shape.top / 100) * height,
        width: shape.size,
        height: shape.size,
        borderRadius: shape.squircle ? shape.size * 0.25 : shape.size / 2,
        transform: [{ rotate: `${shape.rotate}deg` }],
        ...(shape.ring
          ? {
              borderWidth: Math.max(6, shape.size * 0.08),
              borderColor: shape.color,
            }
          : { backgroundColor: shape.color }),
        opacity: shape.opacity,
      }}
    />
  ));
}

// The poster itself: background + quote, with nothing interactive. Rendered
// twice — once visibly and full-screen, once square as the capture source with
// branding attached.
function PosterFace({ background, quote, branded, chromeFont }) {
  return (
    <View style={styles.face}>
      <LinearGradient
        colors={background.colors}
        start={background.start}
        end={background.end}
        style={StyleSheet.absoluteFill}
      />
      <BackgroundShapes shapes={background.shapes} />
      <View style={[styles.content, branded && styles.contentBranded]}>
        <Text style={[styles.quote, { fontSize: quoteFontSize(quote) }]}>
          {quote}
        </Text>
      </View>
      {branded && (
        <View style={styles.watermark}>
          {/* The source PNG is mostly transparent padding, so clip to the
              petals instead of leaving a large gap above the wordmark. */}
          <View style={styles.watermarkLotusClip}>
            <Image
              source={LOTUS_MARK}
              style={styles.watermarkLotus}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.watermarkText, chromeFont]}>Sheetposo</Text>
        </View>
      )}
    </View>
  );
}

function Poster() {
  const [quote, setQuote] = useState(() => randomQuote());
  const [bgIndex, setBgIndex] = useState(() => randomBackgroundIndex());
  // UI chrome uses Poppins (see BRAND.md). A font failure is not fatal: we
  // fall back to the system face rather than blocking startup.
  const [fontsLoaded, fontError] = useFonts({ Poppins_500Medium });
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  const startupDone = fontsLoaded || !!fontError || splashTimedOut;
  // Only claim the family once it is actually registered.
  const chromeFont = fontsLoaded ? { fontFamily: "Poppins_500Medium" } : null;
  const handledResponseRef = useRef(null);
  const lastResponse = Notifications.useLastNotificationResponse();
  const captureRefTarget = useRef(null);
  // Shared images are 1:1. Sized to the screen width so the layout matches
  // what is on screen, then exported at a fixed resolution.
  const { width: screenWidth } = useWindowDimensions();
  const shareSize = screenWidth;

  const [toastMessage, setToastMessage] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  // History of quotes actually shown to this user. The rest stay hidden.
  const [seen, setSeen] = useState([]);
  const [seenLoaded, setSeenLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashTimedOut(true), SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (fontError) {
      console.warn("Poppins failed to load; using the system font.", fontError);
    }
  }, [fontError]);

  // Hide the splash only once startup work has actually settled.
  useEffect(() => {
    if (!startupDone) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [startupDone]);

  // Load the stored history, plus anything sitting in the notification tray.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadSeenQuotes(), presentedQuotes()])
      .then(([stored, tray]) => {
        if (cancelled) return;
        const merged = [...stored];
        for (const entry of tray) {
          if (!merged.includes(entry)) merged.push(entry);
        }
        setSeen(merged);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSeenLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Record whatever is on screen, but only once the stored history has loaded,
  // so the first render cannot overwrite it with a single entry.
  useEffect(() => {
    if (!seenLoaded || !quote) return;
    setSeen((prev) => (prev.includes(quote) ? prev : [...prev, quote]));
  }, [quote, seenLoaded]);

  useEffect(() => {
    if (!seenLoaded) return;
    saveSeenQuotes(seen);
  }, [seen, seenLoaded]);

  // Runs after mount, so permissions and channel setup never block first paint.
  useEffect(() => {
    rescheduleIfNeeded().catch((error) => {
      // Notifications are best-effort; the poster screen works regardless.
      console.warn("Notification scheduling failed:", error);
    });
  }, []);

  // Opening the app from a notification shows that exact quote.
  useEffect(() => {
    if (!lastResponse || lastResponse === handledResponseRef.current) return;
    handledResponseRef.current = lastResponse;
    const tapped = quoteFromNotification(lastResponse);
    if (tapped) {
      setQuote(tapped);
      setBgIndex((prev) => randomBackgroundIndex(prev));
    }
  }, [lastResponse]);

  const showToast = useCallback(
    (message) => {
      clearTimeout(toastTimer.current);
      setToastMessage(message);
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setToastMessage(null);
        });
      }, TOAST_VISIBLE_MS);
    },
    [toastOpacity]
  );

  const shuffle = useCallback(() => {
    setQuote((prev) => randomQuote(prev));
    setBgIndex((prev) => randomBackgroundIndex(prev));
  }, []);

  const background = BACKGROUNDS[bgIndex];

  // Shares the poster image alone — no caption, link, or other text.
  const shareImage = useCallback(async () => {
    try {
      const uri = await captureRef(captureRefTarget, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        // Fixed output so every share is the same size regardless of screen
        // density, and large enough for chat apps not to soften it.
        width: SHARE_IMAGE_PX,
        height: SHARE_IMAGE_PX,
      });
      if (!(await Sharing.isAvailableAsync())) {
        showToast("Sharing unavailable.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch (error) {
      console.warn("Share failed:", error);
      showToast("Couldn't share.");
    }
  }, [showToast]);

  // Keep the splash up rather than flashing an unstyled first frame.
  if (!startupDone) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* Capture source. Square, because chat apps crop tall images in the
          message preview and the watermark would be cut off. Sits behind the
          visible poster, which covers it completely, so it never appears on
          screen — and the capture needs no flicker-inducing state toggle. */}
      <View
        ref={captureRefTarget}
        collapsable={false}
        pointerEvents="none"
        testID="capture-layer"
        style={[styles.captureLayer, { width: shareSize, height: shareSize }]}
      >
        <PosterFace
          background={background}
          quote={quote}
          chromeFont={chromeFont}
          branded
        />
      </View>

      <View testID="visible-layer" style={StyleSheet.absoluteFill}>
        <PosterFace background={background} quote={quote} />
      </View>

      <View style={styles.footer} pointerEvents="box-none">
        {toastMessage && (
          <Animated.View
            style={[styles.toast, { opacity: toastOpacity }]}
            pointerEvents="none"
          >
            <Text style={[styles.toastText, chromeFont]}>{toastMessage}</Text>
          </Animated.View>
        )}
        <Pressable
          onPress={shuffle}
          accessibilityRole="button"
          accessibilityLabel="Shuffle quote"
          testID="shuffle-button"
          style={({ pressed }) => [
            styles.pill,
            styles.shuffleButton,
            pressed && styles.pillPressed,
          ]}
        >
          <Text style={[styles.pillText, styles.shuffleText, chromeFont]}>
            Shuffle
          </Text>
        </Pressable>
        {/* Text-only label: no icon font to fail to load. */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={shareImage}
            accessibilityRole="button"
            accessibilityLabel="Share as image"
            testID="share-button"
            style={({ pressed }) => [
              styles.pill,
              styles.actionButton,
              pressed && styles.pillPressed,
            ]}
          >
            <Text style={[styles.pillText, chromeFont]}>Share</Text>
          </Pressable>
          <Pressable
            onPress={() => setHistoryOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Previously seen quotes"
            testID="seen-button"
            style={({ pressed }) => [
              styles.pill,
              styles.actionButton,
              pressed && styles.pillPressed,
            ]}
          >
            <Text style={[styles.pillText, chromeFont]}>Seen</Text>
          </Pressable>
        </View>
        <Text style={[styles.brand, chromeFont]}>SHEETPOSO</Text>
      </View>

      <SeenSheet
        visible={historyOpen}
        seen={seen}
        chromeFont={chromeFont}
        onClose={() => setHistoryOpen(false)}
        onPick={(picked) => {
          setQuote(picked);
          setBgIndex((prev) => randomBackgroundIndex(prev));
          setHistoryOpen(false);
        }}
      />
    </View>
  );
}

// Shows only what this user has actually been shown. The rest of the list is
// deliberately not reachable from here — unseen quotes stay a surprise.
function SeenSheet({ visible, seen, chromeFont, onClose, onPick }) {
  // Most recent first: the one they just read is the one they want.
  const ordered = [...seen].reverse();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="seen-sheet"
    >
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, chromeFont]}>seen so far</Text>
            <Text style={[styles.sheetCount, chromeFont]}>
              {`${ordered.length} of ${QUOTES.length}`}
            </Text>
          </View>

          {ordered.length === 0 ? (
            <Text style={[styles.sheetEmpty, chromeFont]}>
              nothing yet. the rest are a surprise.
            </Text>
          ) : (
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
            >
              {ordered.map((entry, i) => (
                <Pressable
                  key={`${i}-${entry}`}
                  onPress={() => onPick(entry)}
                  style={({ pressed }) => [
                    styles.seenRow,
                    pressed && styles.seenRowPressed,
                  ]}
                >
                  <Text style={styles.seenText}>{entry}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="seen-close"
            style={({ pressed }) => [
              styles.pill,
              styles.actionButton,
              styles.sheetClose,
              pressed && styles.pillPressed,
            ]}
          >
            <Text style={[styles.pillText, chromeFont]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Poster />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.sage,
  },
  face: {
    flex: 1,
  },
  captureLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  // The square has far less height than the screen, so keep the quote clear
  // of the watermark sitting at the bottom of it.
  contentBranded: {
    paddingBottom: 74,
    paddingHorizontal: 26,
  },
  // The quote stays loud on purpose — the calm wrapper is the joke (BRAND.md).
  quote: {
    color: BRAND.cream,
    fontWeight: "900",
    textAlign: "center",
    // Lowercased on purpose: reads casual rather than dramatic.
    textTransform: "lowercase",
    letterSpacing: 1,
    textShadowColor: "rgba(60, 70, 55, 0.45)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  watermark: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 26,
    alignItems: "center",
  },
  watermarkLotusClip: {
    width: 30,
    height: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
  },
  watermarkLotus: {
    width: 76,
    height: 76,
  },
  watermarkText: {
    marginTop: 6,
    color: BRAND.sand,
    opacity: 0.85,
    fontSize: 11,
    letterSpacing: 2.5,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingBottom: 44,
    gap: 14,
  },
  toast: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 18,
    backgroundColor: "rgba(60, 70, 55, 0.82)",
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 22,
  },
  toastText: {
    color: BRAND.cream,
    fontSize: 14,
    letterSpacing: 1.5,
  },
  // Shared pill shape so Shuffle, Share, and Copy read as one family.
  pill: {
    backgroundColor: "rgba(110, 127, 104, 0.5)",
    borderColor: "rgba(247, 243, 234, 0.7)",
    borderWidth: 1.5,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pillPressed: {
    backgroundColor: BRAND.sageDeep,
  },
  pillText: {
    color: BRAND.cream,
    fontSize: 15,
    letterSpacing: 2,
  },
  // Shuffle stays the primary action: larger type and a wider tap target.
  shuffleButton: {
    paddingVertical: 14,
    paddingHorizontal: 34,
  },
  shuffleText: {
    fontSize: 17,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    paddingVertical: 11,
    paddingHorizontal: 26,
  },
  brand: {
    color: "rgba(247, 243, 234, 0.6)",
    fontSize: 12,
    letterSpacing: 4,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(40, 48, 38, 0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: BRAND.sage,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 34,
    maxHeight: "82%",
  },
  sheetHeader: {
    alignItems: "center",
    gap: 4,
    marginBottom: 18,
  },
  sheetTitle: {
    color: BRAND.cream,
    fontSize: 19,
    letterSpacing: 2,
  },
  sheetCount: {
    color: BRAND.sand,
    fontSize: 12,
    letterSpacing: 2,
    opacity: 0.9,
  },
  sheetEmpty: {
    color: BRAND.sand,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 42,
    lineHeight: 22,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingBottom: 8,
    gap: 8,
  },
  seenRow: {
    backgroundColor: "rgba(110, 127, 104, 0.45)",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  seenRowPressed: {
    backgroundColor: BRAND.sageDeep,
  },
  seenText: {
    color: BRAND.cream,
    fontSize: 14,
    lineHeight: 20,
    textTransform: "lowercase",
  },
  sheetClose: {
    alignSelf: "center",
    marginTop: 18,
  },
});
