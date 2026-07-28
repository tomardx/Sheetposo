import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
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
import * as Clipboard from "expo-clipboard";
import { captureRef } from "react-native-view-shot";
// Subpath default export: bundles only Feather.ttf instead of all 20 icon
// fonts. Verified this subpath exports Feather as the default, not a named.
import Feather from "@expo/vector-icons/Feather";
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

// Both are synchronous, JS-only registrations: safe at module scope.
installGlobalErrorHandler();
configureNotificationHandling();

// Hold the splash before any async startup work begins. Never let a failure
// here reject unhandled — a missing splash is not worth crashing over.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Backstop so a stalled font load can never strand the app on the splash.
const SPLASH_TIMEOUT_MS = 5000;
const TOAST_VISIBLE_MS = 1500;

// Transparent lotus layer, reused as the share watermark.
const LOTUS_MARK = require("./assets/adaptive-icon.png");

function randomQuoteIndex(excludeIndex = -1) {
  let idx;
  do {
    idx = Math.floor(Math.random() * QUOTES.length);
  } while (idx === excludeIndex && QUOTES.length > 1);
  return idx;
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
// twice — once visibly, once as the capture source with branding attached.
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
      <View style={styles.content}>
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
  const [quoteIndex, setQuoteIndex] = useState(() => randomQuoteIndex());
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

  const [toastMessage, setToastMessage] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

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
    const tappedIndex =
      lastResponse.notification.request.content.data?.quoteIndex;
    if (
      typeof tappedIndex === "number" &&
      tappedIndex >= 0 &&
      tappedIndex < QUOTES.length
    ) {
      setQuoteIndex(tappedIndex);
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
    setQuoteIndex((prev) => randomQuoteIndex(prev));
    setBgIndex((prev) => randomBackgroundIndex(prev));
  }, []);

  const quote = QUOTES[quoteIndex];
  const background = BACKGROUNDS[bgIndex];

  // Shares the poster image alone — no caption, link, or other text.
  const shareImage = useCallback(async () => {
    try {
      const uri = await captureRef(captureRefTarget, {
        format: "png",
        quality: 1,
        result: "tmpfile",
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

  // Copies the bare quote — no branding, no link.
  const copyQuote = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(quote);
      showToast("Copied.");
    } catch (error) {
      console.warn("Copy failed:", error);
      showToast("Couldn't copy.");
    }
  }, [quote, showToast]);

  // Keep the splash up rather than flashing an unstyled first frame.
  if (!startupDone) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/* Capture source. Sits behind the visible poster, which covers it
          completely, so the watermark never appears on screen — and the
          capture needs no flicker-inducing state toggle. */}
      <View
        ref={captureRefTarget}
        collapsable={false}
        pointerEvents="none"
        testID="capture-layer"
        style={StyleSheet.absoluteFill}
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
          style={({ pressed }) => [
            styles.shuffleButton,
            pressed && styles.shuffleButtonPressed,
          ]}
        >
          <Text style={[styles.shuffleText, chromeFont]}>🔀 Shuffle</Text>
        </Pressable>
        <View style={styles.actionRow}>
          <Pressable
            onPress={shareImage}
            accessibilityRole="button"
            accessibilityLabel="Share as image"
            testID="share-button"
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Feather name="share-2" size={19} color={BRAND.cream} />
          </Pressable>
          <Pressable
            onPress={copyQuote}
            accessibilityRole="button"
            accessibilityLabel="Copy quote text"
            testID="copy-button"
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
          >
            <Feather name="copy" size={19} color={BRAND.cream} />
          </Pressable>
        </View>
        <Text style={[styles.brand, chromeFont]}>SHEETPOSO</Text>
      </View>
    </View>
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
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  // The quote stays loud on purpose — the calm wrapper is the joke (BRAND.md).
  quote: {
    color: BRAND.cream,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
    textShadowColor: "rgba(60, 70, 55, 0.45)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  watermark: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 54,
    alignItems: "center",
  },
  watermarkLotusClip: {
    width: 38,
    height: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
  },
  watermarkLotus: {
    width: 96,
    height: 96,
  },
  watermarkText: {
    marginTop: 7,
    color: BRAND.sand,
    opacity: 0.85,
    fontSize: 13,
    letterSpacing: 3,
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
  shuffleButton: {
    backgroundColor: "rgba(110, 127, 104, 0.5)",
    borderColor: "rgba(247, 243, 234, 0.7)",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 34,
  },
  shuffleButtonPressed: {
    backgroundColor: BRAND.sageDeep,
  },
  shuffleText: {
    color: BRAND.cream,
    fontSize: 17,
    letterSpacing: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 14,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(110, 127, 104, 0.4)",
    borderColor: "rgba(247, 243, 234, 0.45)",
    borderWidth: 1.5,
  },
  iconButtonPressed: {
    backgroundColor: BRAND.sageDeep,
  },
  brand: {
    color: "rgba(247, 243, 234, 0.6)",
    fontSize: 12,
    letterSpacing: 4,
  },
});
