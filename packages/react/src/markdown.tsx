"use client";

/**
 * Top-level `<StreamdMarkdown>` component and `useStreamingMarkdown` hook.
 *
 * The `"use client"` directive at the top of this module marks every
 * export as a client component for Next.js app-router callers. The
 * renderer relies on React state (`useState`, `useRef`, `startTransition`)
 * and cannot run in a server component.
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
import { renderReact } from "./render";
import { useStreamdTheme } from "./theme";
import type {
  ParsedMarkdownSnapshot,
  RenderReactOptions,
  StreamdMarkdownProps,
  UseStreamingMarkdownResult,
} from "./types";
import { assertHasInput, assertStringChunk } from "./validation";

/**
 * Stable signature for a `parseOptions` object. Used by
 * `useStreamingMarkdown` to detect value-level changes without suffering
 * from parent-render object-identity churn.
 *
 * @param options Parser options value as received by the hook.
 * @returns A deterministic JSON string encoding of the options, or `"{}"`
 *   when options is nullish.
 */
function parseOptionsSignature(options: StreamdMarkdownProps["parseOptions"]): string {
  if (!options) return "{}";
  return JSON.stringify(options);
}

/**
 * Internal helper — parses a full source and updates the streaming state
 * ref as a single monomorphic record. The fresh-parse branch is used
 * on mount, reset, and whenever `parseOptions` change resets the parser.
 *
 * @param src Accumulated source to parse.
 * @param parser Existing parser state, or `null` for a fresh parse.
 * @param options Resolved parser options.
 * @param stateRef Mutable ref holding the current `{ src, parser }` pair.
 * @returns A fresh {@link ParsedMarkdownSnapshot} with the parsed tokens
 *   and stable-count boundary.
 */
function runParse(
  src: string,
  parser: ParserState | null,
  options: StreamdMarkdownProps["parseOptions"],
  stateRef: StreamStateRef,
): ParsedMarkdownSnapshot {
  const parsed = parse(src, parser, options);
  stateRef.current = { src, parser: parsed.state };
  return { tokens: parsed.tokens, stableCount: parsed.stableCount };
}

/** Mutable ref tracking the streaming parser state between chunks. */
interface StreamStateRef {
  /** Current accumulated source and parser state pair. `parser` is `null` before the first parse. */
  current: { src: string; parser: ParserState | null };
}

/**
 * Build resolved renderer options from top-level component props,
 * omitting undefined fields so the merge into renderer defaults stays
 * monomorphic and the result is compatible with
 * `exactOptionalPropertyTypes`.
 *
 * @param props Component props.
 * @param prefix Effective class prefix (explicit prop or theme default).
 * @returns A {@link RenderReactOptions} object with only defined fields set,
 *   suitable for passing to `renderReact`.
 */
function buildRenderOptions(props: StreamdMarkdownProps, prefix: string): RenderReactOptions {
  const out: Record<string, unknown> = { classPrefix: prefix };
  if (props.components !== undefined) out["components"] = props.components;
  if (props.math !== undefined) out["math"] = props.math;
  if (props.taskListCheckboxes !== undefined) {
    out["taskListCheckboxes"] = props.taskListCheckboxes;
  }
  if (props.plugins !== undefined) out["plugins"] = props.plugins;
  if (props.allowDangerousMetaHtml === true) out["allowDangerousMetaHtml"] = true;
  return out as RenderReactOptions;
}

/**
 * Render markdown source (or a pre-parsed token list) as React nodes.
 *
 * Wraps the output in a `<div class="${prefix}-root">` container so the
 * theme CSS variables apply. Accepts `source` or `tokens` (one must be
 * provided) plus any of the renderer options, including the C1-gated
 * `allowDangerousMetaHtml` flag which is forwarded to `renderReact`.
 *
 * @param props Component props — see {@link StreamdMarkdownProps}.
 * @returns A `<div class="${prefix}-root">` wrapping the rendered token tree.
 * @throws {@link StreamdReactArgumentError} (kind `"missing-input"`) when
 *   neither `source` nor `tokens` is provided.
 */
export function StreamdMarkdown(props: StreamdMarkdownProps): ReactNode {
  assertHasInput(props.source, props.tokens, "StreamdMarkdown");

  const context = useStreamdTheme();
  const prefix = props.classPrefix ?? context.classPrefix;

  const tokens = useMemo<TokensList>(() => {
    if (props.tokens) return props.tokens;
    if (props.source === undefined) return [];
    return parse(props.source, null, props.parseOptions).tokens;
  }, [props.tokens, props.source, props.parseOptions]);

  const body = renderReact(tokens, buildRenderOptions(props, prefix));

  return createElement("div", { className: `${prefix}-root` }, body);
}

/**
 * Hook for incremental LLM-style streaming parses.
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
 * @returns A {@link UseStreamingMarkdownResult} with the current tokens,
 *   stable-count boundary, and `append` / `reset` callbacks.
 * @throws {@link StreamdReactArgumentError} (kind `"invalid-chunk"`) from
 *   `append` when the caller passes a non-string value.
 */
export function useStreamingMarkdown(
  initialSource: string = "",
  parseOptions?: StreamdMarkdownProps["parseOptions"],
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
