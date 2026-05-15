"use client";

/**
 * Top-level `<StreamdMarkdown>` component and `useStreamingMarkdown` hook.
 *
 * The `"use client"` directive marks every export as a client component
 * for Next.js app-router callers. The renderer relies on React state
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
 * `useStreamingMarkdown` to detect value-level changes.
 *
 * @param options Parser options value.
 * @returns A deterministic JSON string encoding, or `"{}"` when nullish.
 */
function parseOptionsSignature(options: StreamdMarkdownProps["parseOptions"]): string {
  if (!options) return "{}";
  return JSON.stringify(options);
}

/** Mutable ref tracking the streaming parser state between chunks. */
interface StreamStateRef {
  current: { src: string; parser: ParserState | null };
}

/**
 * Internal helper — parses a full source and updates the streaming state ref.
 *
 * @param src Accumulated source to parse.
 * @param parser Existing parser state, or `null` for a fresh parse.
 * @param options Resolved parser options.
 * @param stateRef Mutable ref holding the current state pair.
 * @returns A fresh {@link ParsedMarkdownSnapshot}.
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

/**
 * Build resolved renderer options from component props.
 *
 * @param props Component props.
 * @param prefix Effective class prefix.
 * @returns A {@link RenderReactOptions} object.
 */
function buildRenderOptions(props: StreamdMarkdownProps, prefix: string): RenderReactOptions {
  const out: Record<string, unknown> = { classPrefix: prefix };
  if (props.components !== undefined) out["components"] = props.components;
  if (props.math !== undefined) out["math"] = props.math;
  if (props.taskListCheckboxes !== undefined) out["taskListCheckboxes"] = props.taskListCheckboxes;
  if (props.plugins !== undefined) out["plugins"] = props.plugins;
  return out as RenderReactOptions;
}

/**
 * Render markdown source (or a pre-parsed token list) as React nodes.
 *
 * Wraps the output in a `<div class="${prefix}-root">` container.
 *
 * @param props Component props — see {@link StreamdMarkdownProps}.
 * @returns A `<div>` wrapping the rendered token tree.
 * @throws {@link StreamdReactArgumentError} when neither `source` nor `tokens` is provided.
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
 * @param initialSource Optional starting source. Default: `""`.
 * @param parseOptions Parser options. Reactive — changing resets the parser.
 * @returns A {@link UseStreamingMarkdownResult}.
 * @throws {@link StreamdReactArgumentError} from `append` when the caller passes a non-string.
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
