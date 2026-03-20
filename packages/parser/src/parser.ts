/**
 * Core parser API — `parse()` and `createParser()`.
 *
 * Full document parsing is handled inline. Streaming is delegated
 * to the `streaming/` module which implements incremental fast paths.
 *
 * @module parser
 */

import type { AssembleOpts } from "./assembler/assemble";
import { assemble } from "./assembler/assemble";
import { scanBlocks } from "./scanner/block/scan";
import { streamingParse } from "./streaming/incremental";
import { createInitialState, type StreamState } from "./streaming/state";
import type { ParseOptions, ParseResult, ParserState } from "./types/options";

/**
 * Parse markdown source into a token tree.
 *
 * For streaming: pass the full accumulated source each time with the state
 * from the previous call. No flush needed -- the last call's tokens are final.
 *
 * @param src - Full markdown source
 * @param state - Previous state for streaming, null/undefined for one-shot
 * @param options - Parser configuration
 */
export function parse(
  src: string,
  state?: ParserState | null,
  options?: ParseOptions,
): ParseResult {
  if (!state) return fullParse(src, options);
  return streamingParse(src, state as unknown as StreamState);
}

/** Create a pre-configured parser with bound options. */
export function createParser(
  options?: ParseOptions,
): (src: string, state?: ParserState | null) => ParseResult {
  const frozenOptions = options ? { ...options } : undefined;
  return (src: string, state?: ParserState | null) => parse(src, state, frozenOptions);
}

interface ResolvedOptions {
  math: boolean;
  tables: boolean;
  strikethrough: boolean;
  taskListItems: boolean;
  autolinks: boolean;
}

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

function toAssembleOpts(resolved: ResolvedOptions): AssembleOpts {
  return {
    math: resolved.math,
    strikethrough: resolved.strikethrough,
    autolinks: resolved.autolinks,
    tables: resolved.tables,
    taskListItems: resolved.taskListItems,
  };
}

/** Full document parse -- no prior state. */
function fullParse(src: string, options?: ParseOptions): ParseResult {
  const resolved = resolveOptions(options);
  const opts = toAssembleOpts(resolved);
  const blocks = scanBlocks(src, opts.math, opts.tables, opts.taskListItems);
  const tokens = assemble(src, blocks, opts);

  return {
    tokens,
    stableCount: tokens.length,
    state: createInitialState(src.length, opts) as unknown as ParserState,
  };
}
