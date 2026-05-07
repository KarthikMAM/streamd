/**
 * @streamd/react-native demo running in the browser via react-native-web.
 *
 * Demonstrates theme switching and streaming parse using the native renderer
 * primitives (Text / View / Pressable).
 *
 * @module apps/react-native-demo/src/App
 */
import { StreamdMarkdownNative, ThemeProvider } from "@streamd/react-native";
import { darkTheme, lightTheme, type Theme } from "@streamd/tokens";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import sampleMd from "../../shared/sample.md?raw";
import type {
  ChromeProps,
  ChromeStyles,
  ControlsStyles,
  ErrorBoundaryState,
  ErrorBoundaryStyles,
  ThemeName,
  UseStreamingSourceResult,
} from "./types";

/** Milliseconds between each character emission during streaming replay. */
const STREAM_DELAY_MS = 8;

/**
 * Hook that incrementally reveals `source` character-by-character to simulate
 * an LLM token stream. Returns the accumulated buffer plus `start`/`reset`
 * handles. The streaming loop aborts when the component unmounts.
 *
 * @param source Full markdown to replay.
 * @param enabled When true, `reset()` seeds the buffer with the full source; when false it empties it.
 * @returns Streaming state and control handles.
 */
function useStreamingSource(source: string, enabled: boolean): UseStreamingSourceResult {
  const [accumulated, setAccumulated] = useState("");
  const abortRef = useRef(false);

  useEffect(
    () => () => {
      abortRef.current = true;
    },
    [],
  );

  const start = useCallback(async () => {
    abortRef.current = false;
    setAccumulated("");
    let next = "";
    for (const ch of source) {
      if (abortRef.current) return;
      next += ch;
      setAccumulated(next);
      await new Promise((r) => setTimeout(r, STREAM_DELAY_MS));
    }
  }, [source]);

  const reset = useCallback(() => {
    abortRef.current = true;
    setAccumulated(enabled ? source : "");
  }, [enabled, source]);

  return { accumulated, start, reset };
}

/**
 * Layout chrome for the demo — renders the title bar with theme toggle
 * buttons and scrollable body area containing the markdown output.
 *
 * @param props Chrome component props.
 * @returns The chrome layout wrapping children in a themed shell.
 */
function Chrome({ theme, themeName, onThemeChange, children }: ChromeProps): React.ReactElement {
  const s = buildChromeStyles(theme);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>@streamd/react-native demo</Text>
        <View style={s.themeButtons}>
          {(["light", "dark"] as const).map((n) => (
            <Pressable
              key={n}
              style={[s.btn, themeName === n ? s.btnActive : undefined]}
              onPress={() => onThemeChange(n)}
            >
              <Text style={themeName === n ? s.btnTextActive : s.btnText}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView style={s.scroll}>{children}</ScrollView>
    </View>
  );
}

/**
 * Build the StyleSheet for the {@link Chrome} component from the active theme.
 * Extracted to keep the render function under the function-size limit.
 *
 * @param theme Active theme tokens.
 * @returns Named style map for the chrome layout.
 */
function buildChromeStyles(theme: Theme): ChromeStyles {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: { color: theme.colors.text, fontSize: 22, fontWeight: "700" },
    themeButtons: { flexDirection: "row", gap: theme.spacing.sm },
    btn: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.codeBackground,
    },
    btnActive: {
      backgroundColor: theme.colors.link,
      borderColor: theme.colors.link,
    },
    btnText: { color: theme.colors.text },
    btnTextActive: { color: "#fff", fontWeight: "700" },
    scroll: { flex: 1 },
  });
}

/**
 * Build the StyleSheet for the replay controls row from the active theme.
 * Hoisted out of the render path so the sheet is only recreated when the
 * theme reference changes (via `useMemo`), not on every render.
 *
 * @param theme Active theme tokens.
 * @returns Named style map for the controls row.
 */
function buildControlsStyles(theme: Theme): ControlsStyles {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    cta: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.link,
    },
    ctaText: { color: "#fff", fontWeight: "700" },
    secondaryText: { color: theme.colors.text },
  });
}

/**
 * Minimal React Native error boundary. Catches render / lifecycle errors
 * thrown anywhere in the subtree it wraps and swaps in a native fallback
 * message so the whole app does not unmount.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  readonly state: ErrorBoundaryState = { error: null };

  /** React lifecycle — update state so the next render shows the fallback. */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  /** Render the fallback when an error was captured, otherwise children. */
  render(): ReactNode {
    const { error } = this.state;

    if (error) {
      return (
        <View style={ERROR_BOUNDARY_STYLES.root}>
          <Text style={ERROR_BOUNDARY_STYLES.title}>Something went wrong</Text>
          <Text style={ERROR_BOUNDARY_STYLES.body}>{error.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

/** Styles for the error boundary fallback — neutral palette independent of theme. */
const ERROR_BOUNDARY_STYLES: ErrorBoundaryStyles = StyleSheet.create({
  root: { padding: 24 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8, color: "#b00020" },
  body: { fontSize: 14, color: "#333" },
});

/**
 * Inner application composing the theme provider, Chrome layout, replay
 * controls, and the native `<StreamdMarkdownNative>` renderer. The
 * exported {@link App} wraps this in an {@link ErrorBoundary}.
 *
 * @returns The themed demo content.
 */
function AppContent(): React.ReactElement {
  const [themeName, setThemeName] = useState<ThemeName>("light");
  const theme = themeName === "dark" ? darkTheme : lightTheme;
  const { accumulated, start, reset } = useStreamingSource(sampleMd, false);
  const controlsStyle = useMemo(() => buildControlsStyles(theme), [theme]);

  return (
    <ThemeProvider theme={theme}>
      <Chrome theme={theme} themeName={themeName} onThemeChange={setThemeName}>
        <View style={controlsStyle.row}>
          <Pressable style={controlsStyle.cta} onPress={() => void start()}>
            <Text style={controlsStyle.ctaText}>▶ Replay as stream</Text>
          </Pressable>
          <Pressable onPress={reset}>
            <Text style={controlsStyle.secondaryText}>Reset</Text>
          </Pressable>
        </View>
        <StreamdMarkdownNative
          source={accumulated.length > 0 ? accumulated : sampleMd}
          parseOptions={{ gfm: true, math: true }}
          theme={theme}
        />
      </Chrome>
    </ThemeProvider>
  );
}

/**
 * Top-level demo application. Wraps the real content in an
 * {@link ErrorBoundary} so a render-time failure in the renderer or a
 * plugin surfaces as a diagnostic message instead of a blank screen.
 *
 * @returns The error-boundary-wrapped demo app.
 */
export function App(): React.ReactElement {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
