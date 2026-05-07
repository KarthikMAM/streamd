/**
 * Top-level `<StreamdMarkdownNative>` component and the
 * `useStreamingMarkdown` hook for incremental LLM-style parses.
 *
 * @module markdown
 */
import { type ParserState, parse, type TokensList } from "@streamd/parser";
import {
  createElement,
  type ReactNode,
  startTransition,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { renderReactNative } from "./render";
import { useStreamdTheme } from "./theme";
import type {
  ParsedMarkdownSnapshot,
  RenderReactNativeOptions,
  StreamdMarkdownNativeProps,
  UseStreamingMarkdownResult,
} from "./types";
import { assertHasInput, assertStringChunk } from "./validation";

/**
 * Extract defined optional fields from props for the render call.
 *
 * @param props - Component props to extract from.
 * @returns Partial render options containing only defined fields.
 */
function pickDefinedProps(props: StreamdMarkdownNativeProps): Partial<RenderReactNativeOptions> {
  return {
    ...(props.components ? { components: props.components } : {}),
    ...(props.math ? { math: props.math } : {}),
    ...(props.taskListCheckboxes ? { taskListCheckboxes: props.taskListCheckboxes } : {}),
  };
}

/**
 * Build render options from component props, omitting undefined fields.
 *
 * @param props - Component props to merge.
 * @param theme - Resolved theme override (from props or context).
 * @returns Fully assembled render options for `renderReactNative`.
 */
function buildRenderOptions(
  props: StreamdMarkdownNativeProps,
  theme: StreamdMarkdownNativeProps["theme"],
): RenderReactNativeOptions {
  return {
    ...pickDefinedProps(props),
    ...(props.onLinkPress ? { onLinkPress: props.onLinkPress } : {}),
    ...(props.plugins ? { plugins: props.plugins } : {}),
    ...(theme ? { theme } : {}),
    ...(props.allowDangerousMetaHtml === true ? { allowDangerousMetaHtml: true } : {}),
  };
}

/**
 * Stable signature for a `parseOptions` object. Used by
 * `useStreamingMarkdown` to detect value-level changes without suffering
 * from parent-render object-identity churn.
 *
 * @param options Parser options value as received by the hook.
 * @returns A deterministic string encoding of the options.
 */
function parseOptionsSignature(options: StreamdMarkdownNativeProps["parseOptions"]): string {
  if (!options) return "{}";
  return JSON.stringify(options);
}

/** Mutable ref tracking the streaming parser state between chunks. */
interface StreamStateRef {
  /** Current accumulated source and parser state pair. */
  current: { src: string; parser: ParserState | null };
}

/**
 * Parse `src` and update the streaming state ref in a single
 * monomorphic record. Used on mount, reset, and when `parseOptions`
 * change forces the parser to restart.
 *
 * @param src Accumulated source to parse.
 * @param parser Existing parser state, or `null` for a fresh parse.
 * @param options Resolved parser options.
 * @param stateRef Mutable ref holding the current `{ src, parser }` pair.
 * @returns The freshly computed snapshot.
 */
function runParse(
  src: string,
  parser: ParserState | null,
  options: StreamdMarkdownNativeProps["parseOptions"],
  stateRef: StreamStateRef,
): ParsedMarkdownSnapshot {
  const parsed = parse(src, parser, options);
  stateRef.current = { src, parser: parsed.state };
  return { tokens: parsed.tokens, stableCount: parsed.stableCount };
}

/**
 * Render markdown source (or pre-parsed tokens) to RN nodes.
 *
 * @param props Component props — see {@link StreamdMarkdownNativeProps}.
 * @throws {@link StreamdReactNativeArgumentError} (kind `"missing-input"`)
 *   when neither `source` nor `tokens` is provided.
 */
export function StreamdMarkdownNative(props: StreamdMarkdownNativeProps): ReactNode {
  assertHasInput(props.source, props.tokens, "StreamdMarkdownNative");

  const { theme: themeContext } = useStreamdTheme();
  const theme = props.theme ?? themeContext;

  const tokens = useMemo<TokensList>(() => {
    if (props.tokens) return props.tokens;
    if (props.source === undefined) return [];
    return parse(props.source, null, props.parseOptions).tokens;
  }, [props.tokens, props.source, props.parseOptions]);

  const body = renderReactNative(tokens, buildRenderOptions(props, theme));

  return createElement(
    View,
    { style: { backgroundColor: theme.colors.background, padding: theme.spacing.md } },
    body,
  );
}

/**
 * Hook for incremental LLM-style streaming parses on React Native.
 *
 * Maintains parser + accumulated-source state across calls. Call
 * `append` as each chunk arrives; the returned `tokens` / `stableCount`
 * are re-computed incrementally.
 *
 * `parseOptions` is reactive — changing any field (for example toggling
 * `gfm`) resets the parser and re-parses the accumulated source so
 * subsequent `append` calls honour the new options.
 *
 * `append` wraps its state update in `startTransition` so the parse +
 * render work stays interruptible while the LLM feed is active.
 *
 * @param initialSource Optional starting source. Default: `""`.
 * @param parseOptions Parser options. Reactive — see note above.
 * @throws {@link StreamdReactNativeArgumentError} (kind `"invalid-chunk"`)
 *   from `append` when the caller passes a non-string value.
 */
export function useStreamingMarkdown(
  initialSource: string = "",
  parseOptions?: StreamdMarkdownNativeProps["parseOptions"],
): UseStreamingMarkdownResult {
  const stateRef = useRef<{ src: string; parser: ParserState | null }>({
    src: "",
    parser: null,
  });

  const [activeOptions, setActiveOptions] = useState(parseOptions);
  const signature = parseOptionsSignature(parseOptions);
  const [activeSignature, setActiveSignature] = useState(signature);

  const [snapshot, setSnapshot] = useState<ParsedMarkdownSnapshot>(() => {
    if (initialSource.length > 0) return runParse(initialSource, null, parseOptions, stateRef);
    return { tokens: [], stableCount: 0 };
  });

  const optionsChanged = activeSignature !== signature;
  if (optionsChanged) {
    setActiveSignature(signature);
    setActiveOptions(parseOptions);
    const accumulated = stateRef.current.src;
    stateRef.current = { src: "", parser: null };
    setSnapshot(
      accumulated.length > 0
        ? runParse(accumulated, null, parseOptions, stateRef)
        : { tokens: [], stableCount: 0 },
    );
  }

  const append = useCallback(
    (chunk: unknown): void => {
      assertStringChunk(chunk, "useStreamingMarkdown.append");
      const nextSrc = stateRef.current.src + chunk;
      startTransition(() => {
        setSnapshot(runParse(nextSrc, stateRef.current.parser, activeOptions, stateRef));
      });
    },
    [activeOptions],
  );

  const reset = useCallback(
    (source: string = ""): void => {
      stateRef.current = { src: "", parser: null };
      setSnapshot(
        source.length > 0
          ? runParse(source, null, activeOptions, stateRef)
          : { tokens: [], stableCount: 0 },
      );
    },
    [activeOptions],
  );

  return {
    tokens: snapshot.tokens,
    stableCount: snapshot.stableCount,
    append,
    reset,
  };
}
