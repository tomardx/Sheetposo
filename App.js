import { useCallback, useEffect, useRef, useState } from "react";
import {
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

  useEffect(() => {
    const timer = setTimeout(() => setSplashTimedOut(true), SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

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

  const shuffle = useCallback(() => {
    setQuoteIndex((prev) => randomQuoteIndex(prev));
    setBgIndex((prev) => randomBackgroundIndex(prev));
  }, []);

  const quote = QUOTES[quoteIndex];
  const background = BACKGROUNDS[bgIndex];

  // Keep the splash up rather than flashing an unstyled first frame.
  if (!startupDone) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
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
      <View style={styles.footer}>
        <Pressable
          onPress={shuffle}
          style={({ pressed }) => [
            styles.shuffleButton,
            pressed && styles.shuffleButtonPressed,
          ]}
        >
          <Text style={[styles.shuffleText, chromeFont]}>🔀 Shuffle</Text>
        </Pressable>
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
  footer: {
    alignItems: "center",
    paddingBottom: 48,
    gap: 14,
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
  brand: {
    color: "rgba(247, 243, 234, 0.6)",
    fontSize: 12,
    letterSpacing: 4,
  },
});
