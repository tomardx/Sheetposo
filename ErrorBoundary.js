import { Component } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BRAND } from "./backgrounds";

function formatError(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return [error.message, error.stack].filter(Boolean).join("\n\n");
}

// Catches render-phase crashes so the app shows a message instead of
// disappearing. Voice stays calm and unhelpful, per BRAND.md.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Sheetposo crashed:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something is resting.</Text>
        <Text style={styles.subtitle}>
          The app encountered an error and stopped. Details below.
        </Text>
        <ScrollView style={styles.detailScroll}>
          <Text style={styles.detail}>{formatError(error)}</Text>
        </ScrollView>
      </View>
    );
  }
}

// Surfaces errors thrown outside React's render phase (event handlers,
// async callbacks) instead of letting the app close silently.
export function installGlobalErrorHandler() {
  const errorUtils = global.ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;
  const previousHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    console.error(`Sheetposo ${isFatal ? "fatal" : "non-fatal"} error:`, error);
    previousHandler?.(error, isFatal);
  });
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.sage,
    paddingHorizontal: 28,
    paddingTop: 96,
    paddingBottom: 48,
  },
  title: {
    color: BRAND.cream,
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: 1,
  },
  subtitle: {
    color: BRAND.sand,
    fontSize: 15,
    marginTop: 12,
    lineHeight: 22,
  },
  detailScroll: {
    marginTop: 28,
    backgroundColor: "rgba(60, 70, 55, 0.25)",
    borderRadius: 12,
    padding: 14,
  },
  detail: {
    color: BRAND.cream,
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
  },
});
