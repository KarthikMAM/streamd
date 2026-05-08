/**
 * @streamd/react-native demo running in the browser via react-native-web.
 *
 * Demonstrates:
 * - Theme switching and streaming parse using native renderer primitives.
 * - Component overrides (`code_block`, `math_block`) via the `components` prop.
 * - KaTeX-via-override pattern for math rendering (web path via katex).
 * - `StreamingRevealProvider` with three animation presets (fade, blur, slide-in-left).
 * - `plugin-shiki` integration reading `meta.highlight` for syntax coloring.
 *
 * @module apps/react-native-demo/src/App
 */

import type { CodeBlockProps, Components, MathProps } from "@streamd/react-native";
import { StreamdMarkdownNative, ThemeProvider } from "@streamd/react-native";
import {
  type StreamingAnimationPreset,
  type StreamingRevealConfig,
  StreamingRevealProvider,
} from "@streamd/react-native/streaming";
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

/** The three animation presets showcased in this demo. */
const ANIMATION_PRESETS: ReadonlyArray<StreamingAnimationPreset> = [
  "fade",
  "blur",
  "slide-in-left",
];

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
 * Custom code block component demonstrating the `code_block` override.
 * Renders `meta.highlight` segments as colored `<Text>` nodes when
 * available; falls back to monospace plain text otherwise.
 *
 * @param props Code block props from the renderer.
 * @returns Styled code block with optional syntax highlighting.
 */
function CustomCodeBlock({ lang, content, highlight }: CodeBlockProps): React.ReactElement {
  const hasHighlight = highlight !== undefined && highlight.lines.length > 0;

  return (
    <View style={CODE_BLOCK_STYLES.container}>
      {lang.length > 0 && <Text style={CODE_BLOCK_STYLES.lang}>{lang}</Text>}
      <ScrollView horizontal>
        <Text style={CODE_BLOCK_STYLES.code}>
          {hasHighlight
            ? highlight.lines.map((line, li) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: highlight segments have no stable ID
                <Text key={li}>
                  {line.map((seg, si) => (
                    <Text
                      // biome-ignore lint/suspicious/noArrayIndexKey: segments lack unique identifiers
                      key={si}
                      style={{
                        color: seg.color ?? "#d4d4d4",
                        fontStyle: seg.italic ? "italic" : "normal",
                        fontWeight: seg.bold ? "700" : "400",
                      }}
                    >
                      {seg.text}
                    </Text>
                  ))}
                  {li < highlight.lines.length - 1 ? "\n" : ""}
                </Text>
              ))
            : content}
        </Text>
      </ScrollView>
    </View>
  );
}

/** Styles for the custom code block override. */
const CODE_BLOCK_STYLES = StyleSheet.create({
  container: {
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  lang: {
    color: "#888",
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 4,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#d4d4d4",
  },
});

/**
 * Custom math block component demonstrating the KaTeX-via-override pattern.
 *
 * Web path (react-native-web): renders raw TeX in a styled monospace view
 * with a "TeX" badge. In a production app, this would call
 * `katex.renderToString(content)` and inject the resulting HTML.
 *
 * Native path (not active in this web demo): would use MathJax +
 * react-native-svg to render TeX to SVG elements.
 *
 * @param props Math block props from the renderer.
 * @returns Styled math block with TeX source display.
 */
function CustomMathBlock({ content }: MathProps): React.ReactElement {
  return (
    <View style={MATH_BLOCK_STYLES.container}>
      <Text style={MATH_BLOCK_STYLES.badge}>TeX</Text>
      <Text style={MATH_BLOCK_STYLES.content}>{content}</Text>
    </View>
  );
}

/** Styles for the custom math block override. */
const MATH_BLOCK_STYLES = StyleSheet.create({
  container: {
    backgroundColor: "#f8f4ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0d4f5",
    padding: 12,
    marginVertical: 8,
  },
  badge: {
    color: "#7c3aed",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  content: {
    fontFamily: "monospace",
    fontSize: 14,
    color: "#4c1d95",
  },
});

/** Component overrides map passed to the renderer. */
const COMPONENT_OVERRIDES: Components = {
  code_block: CustomCodeBlock,
  math_block: CustomMathBlock,
};

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
 *
 * @param theme Active theme tokens.
 * @returns Named style map for the chrome layout.
 */
function buildChromeStyles(theme: Theme): ChromeStyles {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
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
    btnActive: { backgroundColor: theme.colors.link, borderColor: theme.colors.link },
    btnText: { color: theme.colors.text },
    btnTextActive: { color: "#fff", fontWeight: "700" },
    scroll: { flex: 1 },
  });
}

/**
 * Build the StyleSheet for the replay controls row from the active theme.
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
      flexWrap: "wrap",
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
 * thrown anywhere in the subtree and surfaces a diagnostic message.
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
 * Inner application composing the theme provider, streaming reveal,
 * Chrome layout, replay controls, and the native renderer with
 * component overrides.
 *
 * @returns The themed demo content.
 */
function AppContent(): React.ReactElement {
  const [themeName, setThemeName] = useState<ThemeName>("light");
  const [animationIdx, setAnimationIdx] = useState(0);
  const theme = themeName === "dark" ? darkTheme : lightTheme;
  const { accumulated, start, reset } = useStreamingSource(sampleMd, false);
  const controlsStyle = useMemo(() => buildControlsStyles(theme), [theme]);

  const isStreaming = accumulated.length > 0 && accumulated.length < sampleMd.length;
  const currentPreset = ANIMATION_PRESETS[animationIdx];

  const streamingConfig = useMemo<StreamingRevealConfig>(
    () => ({
      isStreaming,
      granularity: "word",
      textMode: "smoothed",
      animation: currentPreset,
    }),
    [isStreaming, currentPreset],
  );

  const cycleAnimation = useCallback(() => {
    setAnimationIdx((i) => (i + 1) % ANIMATION_PRESETS.length);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <StreamingRevealProvider config={streamingConfig}>
        <Chrome theme={theme} themeName={themeName} onThemeChange={setThemeName}>
          <View style={controlsStyle.row}>
            <Pressable style={controlsStyle.cta} onPress={() => void start()}>
              <Text style={controlsStyle.ctaText}>▶ Replay as stream</Text>
            </Pressable>
            <Pressable onPress={reset}>
              <Text style={controlsStyle.secondaryText}>Reset</Text>
            </Pressable>
            <Pressable onPress={cycleAnimation}>
              <Text style={controlsStyle.secondaryText}>Animation: {currentPreset}</Text>
            </Pressable>
          </View>
          <StreamdMarkdownNative
            source={accumulated.length > 0 ? accumulated : sampleMd}
            parseOptions={{ gfm: true, math: true }}
            theme={theme}
            components={COMPONENT_OVERRIDES}
          />
        </Chrome>
      </StreamingRevealProvider>
    </ThemeProvider>
  );
}

/**
 * Top-level demo application. Wraps the real content in an
 * {@link ErrorBoundary} so a render-time failure surfaces as a
 * diagnostic message instead of a blank screen.
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
