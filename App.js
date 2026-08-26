import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as SystemStatusBar,
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
import { QUOTES, formatQuote } from "./quotes";
import { BACKGROUNDS, BRAND, randomBackgroundIndex } from "./backgrounds";
import { TIERS, tierById, tierOf, weightedRandomQuote } from "./rarity";
import {
  configureNotificationHandling,
  rescheduleIfNeeded,
} from "./notifications";
import ErrorBoundary, { installGlobalErrorHandler } from "./ErrorBoundary";
import { PATCH_NOTES } from "./patchNotes";
import {
  presentedQuotes,
  saveSeenQuotes,
  syncDeliveredIntoSeen,
} from "./seenQuotes";

// Both are synchronous, JS-only registrations: safe at module scope.
installGlobalErrorHandler();
configureNotificationHandling();

// Hold the splash before any async startup work begins. Never let a failure
// here reject unhandled, a missing splash is not worth crashing over.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Backstop so a stalled font load can never strand the app on the splash.
const SPLASH_TIMEOUT_MS = 5000;
const TOAST_VISIBLE_MS = 1500;
// Exported share image, square. 1080 is what chat apps expect.
const SHARE_IMAGE_PX = 1080;

// Transparent lotus layer, reused as the share watermark.
const LOTUS_MARK = require("./assets/adaptive-icon.png");

// Quotes are held as text, not as an index into QUOTES, so editing the list
// can never make a scheduled notification open the wrong quote. The pull is
// weighted by rarity tier (rarity.js).
function randomQuote(exclude) {
  return weightedRandomQuote(QUOTES, exclude);
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

// Motion earned by rarity. Level 0 renders nothing at all, so the common
// tiers stay completely still and a rare pull is obvious without a label.
function RarityAura({ tier, still }) {
  const { width, height } = useWindowDimensions();
  const breath = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const level = tier.motion;

  useEffect(() => {
    // `still` freezes the capture layer: a share should never catch a
    // half-faded frame.
    if (level < 1 || still) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: level >= 3 ? 1800 : 2800,
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: level >= 3 ? 1800 : 2800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, level, still]);

  useEffect(() => {
    if (level < 2 || still) return undefined;
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: level >= 3 ? 3600 : 5200,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [sweep, level, still]);

  if (level < 1) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: tier.gradient[0],
            opacity: breath.interpolate({
              inputRange: [0, 1],
              outputRange: [0, level >= 3 ? 0.34 : 0.16],
            }),
          },
        ]}
      />
      {level >= 2 && (
        <Animated.View
          style={{
            position: "absolute",
            top: -height * 0.2,
            bottom: -height * 0.2,
            width: width * 0.5,
            backgroundColor: BRAND.cream,
            opacity: level >= 3 ? 0.13 : 0.07,
            transform: [
              { rotate: "18deg" },
              {
                translateX: sweep.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-width, width * 1.6],
                }),
              },
            ],
          }}
        />
      )}
    </View>
  );
}

// The poster itself: background + quote, with nothing interactive. Rendered
// twice, once visibly and full-screen, once square as the capture source with
// branding attached.
function PosterFace({ background, quote, branded, chromeFont }) {
  const tier = tierOf(quote);
  return (
    <View style={styles.face}>
      <LinearGradient
        colors={tier.gradient}
        start={background.start}
        end={background.end}
        style={StyleSheet.absoluteFill}
      />
      <BackgroundShapes shapes={background.shapes} />
      <RarityAura tier={tier} still={branded} />
      <View style={[styles.content, branded && styles.contentBranded]}>
        <Text style={[styles.quote, { fontSize: quoteFontSize(quote) }]}>
          {formatQuote(quote)}
        </Text>
        {tier.motion >= 2 && (
          <Text style={[styles.rarityLabel, chromeFont]}>{tier.label}</Text>
        )}
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
  const [notesOpen, setNotesOpen] = useState(false);

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

  const absorb = useCallback((entries) => {
    if (!entries?.length) return;
    setSeen((prev) => {
      const missing = entries.filter((entry) => entry && !prev.includes(entry));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, []);

  // Everything already delivered counts, whether or not it was opened: quotes
  // whose scheduled time has passed, plus anything still in the tray.
  const refreshSeen = useCallback(async () => {
    const [delivered, tray] = await Promise.all([
      syncDeliveredIntoSeen(),
      presentedQuotes(),
    ]);
    return [...delivered, ...tray];
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshSeen()
      .then((entries) => {
        if (!cancelled) absorb(entries);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSeenLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [absorb, refreshSeen]);

  // Coming back to the app re-checks, so notifications that fired while it was
  // in the background are picked up without needing a relaunch.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      refreshSeen()
        .then(absorb)
        .catch(() => {});
    });
    return () => sub.remove();
  }, [absorb, refreshSeen]);

  // And if one fires while the app is open, record it immediately.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((incoming) => {
      const content = incoming?.request?.content;
      const text =
        typeof content?.data?.quoteText === "string" && content.data.quoteText
          ? content.data.quoteText
          : content?.body;
      if (typeof text === "string" && text) absorb([text]);
    });
    return () => sub.remove();
  }, [absorb]);

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

  // Shares the poster image alone, no caption, link, or other text.
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
          screen, and the capture needs no flicker-inducing state toggle. */}
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

      {/* Deliberately outside the capture layer, so it never lands in a
          shared image. */}
      <Pressable
        onPress={() => setNotesOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="What's new"
        testID="whats-new-button"
        hitSlop={12}
        style={({ pressed }) => [styles.whatsNew, pressed && styles.whatsNewPressed]}
      >
        <Text style={[styles.whatsNewText, chromeFont]}>What's new?</Text>
      </Pressable>

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

      <PatchNotesSheet
        visible={notesOpen}
        chromeFont={chromeFont}
        onClose={() => setNotesOpen(false)}
      />

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

// Patch notes, laid out like a changelog: version and date, then a heading
// per group with its bullets. Rendered natively rather than parsed from
// markdown, which keeps the type on the brand's scale and adds no dependency.
function PatchNotesSheet({ visible, chromeFont, onClose }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="patch-notes-sheet"
    >
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, chromeFont]}>What's new?</Text>
            <Text style={[styles.sheetCount, chromeFont]}>
              nothing important
            </Text>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.notesContent}
          >
            {PATCH_NOTES.map((release) => (
              <View key={release.version} style={styles.release}>
                <View style={styles.releaseHead}>
                  <Text style={[styles.releaseVersion, chromeFont]}>
                    {`${release.version}: ${release.title}`}
                  </Text>
                  <Text style={[styles.releaseDate, chromeFont]}>
                    {release.date}
                  </Text>
                </View>

                {release.sections.map((section) => (
                  <View key={section.heading} style={styles.releaseSection}>
                    <Text style={[styles.releaseHeading, chromeFont]}>
                      {section.heading}
                    </Text>
                    {section.items.map((item, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="patch-notes-close"
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

// Shows only what this user has actually been shown. The rest of the list is
// deliberately not reachable from here, unseen quotes stay a surprise.
function SeenSheet({ visible, seen, chromeFont, onClose, onPick }) {
  // null means no filter. Only tiers the user has actually collected are
  // offered, so the filter never hints at what is still out there.
  const [tierFilter, setTierFilter] = useState(null);

  // A tier can drop out of the list between openings, so clear the filter
  // each time rather than leaving it stuck on an empty selection.
  useEffect(() => {
    if (visible) setTierFilter(null);
  }, [visible]);

  const counts = new Map();
  for (const entry of seen) {
    const id = tierOf(entry).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const collected = TIERS.filter((tier) => counts.has(tier.id));

  // Most recent first: the one they just read is the one they want.
  const ordered = [...seen]
    .reverse()
    .filter((entry) => !tierFilter || tierOf(entry).id === tierFilter);

  const active = tierFilter ? tierById(tierFilter) : null;
  const countLabel = active
    ? `${ordered.length} ${active.label.toLowerCase()}`
    : `${seen.length} of ${QUOTES.length}`;

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
            <Text style={[styles.sheetCount, chromeFont]}>{countLabel}</Text>
          </View>

          {collected.length > 1 && (
            // Wraps rather than scrolls. There are never more than eight
            // chips, and a horizontal scroller gave no hint that the ones
            // past the edge existed.
            <View style={styles.filterRow} testID="seen-filters">
              <Pressable
                onPress={() => setTierFilter(null)}
                testID="seen-filter-all"
                style={[
                  styles.filterChip,
                  !tierFilter && styles.filterChipOn,
                ]}
              >
                <Text style={[styles.filterChipText, chromeFont]}>
                  {`All ${seen.length}`}
                </Text>
              </Pressable>
              {collected.map((tier) => {
                const on = tierFilter === tier.id;
                return (
                  <Pressable
                    key={tier.id}
                    onPress={() => setTierFilter(on ? null : tier.id)}
                    testID={`seen-filter-${tier.id}`}
                    style={[
                      styles.filterChip,
                      on && styles.filterChipOn,
                      on && { backgroundColor: tier.color },
                    ]}
                  >
                    <View
                      style={[styles.filterDot, { backgroundColor: tier.color }]}
                    />
                    <Text style={[styles.filterChipText, chromeFont]}>
                      {`${tier.short} ${counts.get(tier.id)}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {ordered.length === 0 ? (
            <Text style={[styles.sheetEmpty, chromeFont]}>
              nothing yet. the rest are a surprise.
            </Text>
          ) : (
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
            >
              {ordered.map((entry, i) => {
                const tier = tierOf(entry);
                return (
                  <Pressable
                    key={`${i}-${entry}`}
                    onPress={() => onPick(entry)}
                    style={({ pressed }) => [
                      styles.seenRow,
                      { borderLeftColor: tier.color },
                      pressed && styles.seenRowPressed,
                    ]}
                  >
                    <Text style={styles.seenText}>{formatQuote(entry)}</Text>
                    <Text style={styles.seenTier}>{tier.label}</Text>
                  </Pressable>
                );
              })}
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
  // The quote stays loud on purpose, the calm wrapper is the joke (BRAND.md).
  quote: {
    color: BRAND.cream,
    fontWeight: "900",
    textAlign: "center",
    // No textTransform: the list is authored lowercase and formatQuote()
    // capitalises the opening letter, so forcing a case here would undo it.
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
  // Top-right, clear of the quote and below the status bar.
  whatsNew: {
    position: "absolute",
    right: 16,
    top: (Platform.OS === "android" ? SystemStatusBar.currentHeight ?? 24 : 44) + 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    // Backgrounds run from pale sage to near-black, so the label needs to
    // carry its own contrast rather than borrow the poster's.
    backgroundColor: "rgba(35, 43, 33, 0.32)",
  },
  whatsNewPressed: {
    backgroundColor: "rgba(35, 43, 33, 0.55)",
  },
  whatsNewText: {
    color: BRAND.cream,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  notesContent: {
    paddingBottom: 8,
    gap: 22,
  },
  release: {
    gap: 12,
  },
  releaseHead: {
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(247, 243, 234, 0.22)",
    paddingBottom: 8,
  },
  releaseVersion: {
    color: BRAND.cream,
    fontSize: 15,
    letterSpacing: 1,
  },
  releaseDate: {
    color: BRAND.sand,
    fontSize: 11,
    letterSpacing: 1.5,
    opacity: 0.85,
  },
  releaseSection: {
    gap: 6,
  },
  releaseHeading: {
    color: BRAND.sand,
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  bulletDot: {
    color: "rgba(247, 243, 234, 0.55)",
    fontSize: 13,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    color: BRAND.cream,
    fontSize: 13.5,
    lineHeight: 20,
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  // Fixed height with centred content: Poppins at this size was being
  // bottom-clipped when the chip sized itself to the text.
  //
  // The border is ink rather than the tier colour. Half the tiers are close
  // enough to sage that a tier-coloured outline vanished into the sheet and
  // the chip stopped looking like a chip. The colour lives on the dot, and on
  // the fill once selected.
  filterChip: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1.5,
    borderColor: BRAND.ink,
    borderRadius: 999,
    paddingHorizontal: 13,
  },
  filterChipOn: {
    backgroundColor: BRAND.cream,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // Every tier colour is mid-tone, so a hairline of ink keeps the pale ones
    // off the sage and the dark ones off a selected chip's fill.
    borderWidth: 0.5,
    borderColor: "rgba(14, 18, 13, 0.4)",
  },
  // Ink, not the tier colour. Several tiers are close enough to sage that
  // their own colour was unreadable against the sheet, and ink stays legible
  // on every tier background a selected chip can take.
  filterChipText: {
    color: BRAND.ink,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1,
    includeFontPadding: false,
  },
  sheetScrollContent: {
    paddingBottom: 8,
    gap: 8,
  },
  seenRow: {
    backgroundColor: "rgba(110, 127, 104, 0.45)",
    borderRadius: 14,
    // The tier colour rides on this edge, set per row.
    borderLeftWidth: 4,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 5,
  },
  seenRowPressed: {
    backgroundColor: BRAND.sageDeep,
  },
  seenText: {
    color: BRAND.cream,
    fontSize: 14,
    lineHeight: 20,
  },
  // The tier colour is already on the row's left edge. Repeating it in the
  // label made the label invisible, so this is ink.
  seenTier: {
    color: BRAND.ink,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "lowercase",
    // Secondary, but not so faint it stops being text. 0.75 read as a smudge.
    opacity: 0.9,
  },
  // Only shown from "somewhere between rare and legendary" upward, so the
  // common tiers never announce themselves.
  rarityLabel: {
    marginTop: 22,
    color: "rgba(247, 243, 234, 0.75)",
    fontSize: 11,
    letterSpacing: 3,
    textAlign: "center",
    textTransform: "lowercase",
  },
  sheetClose: {
    alignSelf: "center",
    marginTop: 18,
  },
});
