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
import { QUOTES } from "./quotes";
import { BACKGROUNDS, randomBackgroundIndex } from "./backgrounds";
import {
  configureNotificationHandling,
  rescheduleIfNeeded,
} from "./notifications";

configureNotificationHandling();

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

export default function App() {
  const [quoteIndex, setQuoteIndex] = useState(() => randomQuoteIndex());
  const [bgIndex, setBgIndex] = useState(() => randomBackgroundIndex());
  const handledResponseRef = useRef(null);
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    rescheduleIfNeeded().catch(() => {
      // Notifications are best-effort; the poster screen works regardless.
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
          <Text style={styles.shuffleText}>🔀 Shuffle</Text>
        </Pressable>
        <Text style={styles.brand}>SHEETPOSO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  quote: {
    color: "#fff",
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  footer: {
    alignItems: "center",
    paddingBottom: 48,
    gap: 14,
  },
  shuffleButton: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderColor: "rgba(255, 255, 255, 0.6)",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 34,
  },
  shuffleButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  shuffleText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  brand: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 4,
  },
});
