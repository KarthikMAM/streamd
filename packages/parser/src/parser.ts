/**
 * Core parser orchestrator — implements `parse()` and streaming.
 *
 * Both full and streaming parse use the flat scan-to-completion architecture.
 * Streaming accumulates source chunks and re-scans the active region.
 *
 * @module parser
 */

import type { AssembleOpts } from "./assembler/assemble";
import { assemble } from "./assembler/assemble";
import { scanBlocks } from "./scanner/block/scan";
import type { Block } from "./scanner/block/types";
import { CC_LF } from "./scanner/constants";
import type { LinkReference } from "./types/internal";
import type { ParseOptions, ParseResult, ParserState } from "./types/options";
import type { Token } from "./types/tokens";

/**
 * Internal streaming state — stored opaquely behind ParserState.
 *
 * Tracks accumulated source, completed blocks/tokens, and options
 * so that each new chunk only re-scans the active (last) block region.
 */
interface StreamState {
  source: string;
  lastLineEnd: number;
  opts: AssembleOpts;
  /** Tokens from fully completed blocks (won't change). */
  completedTokens: Array<Token>;
  /** Flat blocks from the last scan — used for incremental re-scan. */
  lastBlocks: Array<Block>;
  /** RefMap accumulated from completed blocks. */
  refMap: Map<string, LinkReference>;
}

/**
 * Parse markdown source into a token tree.
 *
 * @param src - Markdown source string (or chunk for streaming)
 * @param state - Previous parser state for streaming, null/undefined for full parse
 * @param options - Parser configuration (extensions, math, etc.)
 */
export function parse(
  src: string,
  state?: ParserState | null,
  options?: ParseOptions,
): ParseResult {
  if (!state) {
    return fullParse(src, options);
  }
  return streamingParse(src, state as unknown as StreamState);
}

/**
 * Create a pre-configured parser with bound options.
 * Snapshots options at creation time — returns a bound parse function.
 */
export function createParser(
  options?: ParseOptions,
): (src: string, state?: ParserState | null) => ParseResult {
  const frozenOptions = options ? { ...options } : undefined;
  return (src: string, state?: ParserState | null) => parse(src, state, frozenOptions);
}

/**
 * Resolved parser options — all flags explicitly set.
 */
interface ResolvedOptions {
  math: boolean;
  tables: boolean;
  strikethrough: boolean;
  taskListItems: boolean;
  autolinks: boolean;
}

/** Resolve effective options — `gfm` flag enables sub-features. */
function resolveOptions(options?: ParseOptions): ResolvedOptions {
  const gfm = options?.gfm ?? false;
  return {
    math: options?.math ?? false,
    tables: options?.tables ?? gfm,
    strikethrough: options?.strikethrough ?? gfm,
    taskListItems: options?.taskListItems ?? gfm,
    autolinks: options?.autolinks ?? gfm,
  };
}

/** Build AssembleOpts from resolved options. */
function toAssembleOpts(resolved: ResolvedOptions): AssembleOpts {
  return {
    math: resolved.math,
    strikethrough: resolved.strikethrough,
    autolinks: resolved.autolinks,
    tables: resolved.tables,
    taskListItems: resolved.taskListItems,
  };
}

/** Full document parse — no prior state. */
function fullParse(src: string, options?: ParseOptions): ParseResult {
  const resolved = resolveOptions(options);
  const opts = toAssembleOpts(resolved);
  const blocks = scanBlocks(src, opts.math, opts.tables, opts.taskListItems);
  const tokens = assemble(src, blocks, opts);

  const streamState: StreamState = {
    source: src,
    lastLineEnd: src.length,
    opts,
    completedTokens: [],
    lastBlocks: blocks,
    refMap: new Map(),
  };

  return {
    tokens,
    stableCount: tokens.length,
    state: streamState as unknown as ParserState,
  };
}

/** Streaming parse — continue from prior state. */
function streamingParse(src: string, state: StreamState): ParseResult {
  const opts = state.opts;

  // Flush: empty string = finalize
  if (src.length === 0) {
    // Re-scan the full accumulated source for final output
    const blocks = scanBlocks(state.source, opts.math, opts.tables, opts.taskListItems);
    const tokens = assemble(state.source, blocks, opts);
    return {
      tokens,
      stableCount: tokens.length,
      state: state as unknown as ParserState,
    };
  }

  // Append chunk to accumulated source
  const prevSource = state.source;
  state.source = prevSource.length > 0 ? prevSource + src : src;
  const fullSrc = state.source;

  // Find last complete line boundary
  let lastComplete = fullSrc.length;
  if (lastComplete > 0 && fullSrc.charCodeAt(lastComplete - 1) !== CC_LF) {
    // Incomplete line at end — find the last newline
    const lastNL = fullSrc.lastIndexOf("\n");
    if (lastNL >= 0) {
      lastComplete = lastNL + 1;
    } else {
      lastComplete = 0;
    }
  }

  // Only scan complete lines
  const scanSrc = lastComplete > 0 ? fullSrc.slice(0, lastComplete) : "";
  state.lastLineEnd = lastComplete;

  if (scanSrc.length === 0) {
    return {
      tokens: [],
      stableCount: 0,
      state: state as unknown as ParserState,
    };
  }

  const blocks = scanBlocks(scanSrc, opts.math, opts.tables, opts.taskListItems);
  const tokens = assemble(scanSrc, blocks, opts);

  // stableCount: all blocks except the last one are stable
  // (the last block might continue with the next chunk)
  const stableCount = blocks.length > 0 ? Math.max(0, tokens.length - 1) : 0;

  state.lastBlocks = blocks;

  return {
    tokens,
    stableCount,
    state: state as unknown as ParserState,
  };
}
