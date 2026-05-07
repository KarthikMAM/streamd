/**
 * @streamd/react demo app.
 *
 * Features:
 *   - Theme toggle between built-in light and dark themes
 *   - Live markdown editor with streaming parse
 *   - "Replay as stream" button to simulate LLM token-by-token emission
 *
 * @module apps/react-demo/src/App
 */
import { StreamdMarkdown, ThemeProvider, useStreamingMarkdown } from "@streamd/react";
import { darkTheme, lightTheme } from "@streamd/tokens";
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import sampleMd from "../../shared/sample.md?raw";
import type {
  StreamingReplayProps,
  ThemeName,
  ThemeSelectorProps,
  UseLiveParseResult,
} from "./types";

/** Delay in milliseconds between each character during stream replay. */
const REPLAY_CHAR_DELAY_MS = 6;

/**
 * Controlled-source hook for the editor pane. Returns the current source
 * and a setter — a thin wrapper over `useState` kept separate to make
 * component signatures explicit.
 *
 * @param initial - Initial markdown source.
 * @returns The current source string and its setter.
 */
function useLiveParse(initial: string): UseLiveParseResult {
  const [source, setSource] = useState(initial);
  return { source, setSource };
}

/**
 * Button-group control that switches between the built-in `light` and
 * `dark` themes. Purely presentational — state lives in the caller.
 *
 * @param props - Theme name and change callback.
 * @returns Theme toggle button group.
 */
function ThemeSelector({ theme, onChange }: ThemeSelectorProps): ReactNode {
  return (
    <div className="theme-selector">
      {(["light", "dark"] as const).map((name) => (
        <button
          type="button"
          key={name}
          className={theme === name ? "active" : ""}
          onClick={() => onChange(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

/**
 * Panel that replays the editor source character-by-character as if it
 * were an LLM stream. Uses `useStreamingMarkdown` so the parser does
 * incremental work per chunk and the renderer re-renders from tokens.
 *
 * @param props - Contains the full markdown source to replay.
 * @returns Streaming replay panel with controls and rendered output.
 */
function StreamingReplay({ source }: StreamingReplayProps): ReactNode {
  const { tokens, append, reset } = useStreamingMarkdown("", { gfm: true });
  /** Cancellation flag — set to `true` by the cleanup effect to abort an in-flight replay. */
  const abortRef = useRef<boolean>(false);

  /**
   * Kicks off a character-by-character replay of the source string.
   * Resets the streaming parser, then feeds one character per tick
   * with a fixed delay. Aborts early when `abortRef` is set.
   */
  const start = useCallback(async () => {
    abortRef.current = false;
    reset("");

    for (const ch of source) {
      if (abortRef.current) return;
      append(ch);
      await new Promise((r) => setTimeout(r, REPLAY_CHAR_DELAY_MS));
    }
  }, [append, reset, source]);

  /** Abort any in-flight replay when the component unmounts. */
  useEffect(
    () => () => {
      abortRef.current = true;
    },
    [],
  );

  return (
    <div className="stream-panel">
      <div className="controls">
        <button type="button" onClick={() => void start()}>
          ▶ Replay as stream
        </button>
        <button type="button" onClick={() => reset("")}>
          Reset
        </button>
      </div>
      <div className="stream-output">
        <StreamdMarkdown tokens={tokens} />
      </div>
    </div>
  );
}

/**
 * State carried by {@link ErrorBoundary}. When `error` is non-null, the
 * fallback UI is rendered in place of the wrapped subtree.
 */
interface ErrorBoundaryState {
  /** The captured render error, or `null` when the subtree is healthy. */
  readonly error: Error | null;
}

/**
 * Minimal React error boundary. Catches render / lifecycle errors thrown
 * anywhere in the subtree it wraps, logs them, and renders a fallback so
 * the demo page does not go completely blank on a renderer or plugin
 * failure.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  readonly state: ErrorBoundaryState = { error: null };

  /** React lifecycle — move to the fallback render on the next paint. */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  /**
   * React lifecycle — log the error so it never disappears silently.
   *
   * @param error - The error caught by the boundary.
   */
  componentDidCatch(error: Error): void {
    console.error("react-demo error boundary caught:", error);
  }

  /** Render the fallback when a captured error is held, otherwise children. */
  render(): ReactNode {
    const { error } = this.state;

    if (error) {
      return (
        <div className="error-fallback" role="alert">
          <h2>Something went wrong</h2>
          <pre>{error.message}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Inner demo app — composes the theme provider, editor, live preview
 * pane, and streaming replay panel. Wrapped by {@link App} in an error
 * boundary.
 *
 * @returns The full demo layout with editor, preview, and streaming panels.
 */
function AppContent(): ReactNode {
  const [themeName, setThemeName] = useState<ThemeName>("light");
  const { source, setSource } = useLiveParse(sampleMd);
  const theme = themeName === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <div className="layout">
        <header>
          <h1>@streamd/react demo</h1>
          <ThemeSelector theme={themeName} onChange={setThemeName} />
        </header>
        <section className="panes">
          <div className="pane editor">
            <h2>Source</h2>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              rows={30}
            />
          </div>
          <div className="pane preview">
            <h2>Live preview</h2>
            <StreamdMarkdown source={source} parseOptions={{ gfm: true, math: true }} />
          </div>
        </section>
        <StreamingReplay source={source} />
      </div>
    </ThemeProvider>
  );
}

/**
 * Top-level demo application. Wraps the real content in an
 * {@link ErrorBoundary} so a render-time failure surfaces as a
 * diagnostic message instead of a blank page.
 *
 * @returns The app wrapped in an error boundary.
 */
export function App(): ReactNode {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
