/**
 * Streaming state — tracks incremental parse progress between calls.
 *
 * Cached metadata about the active (last) block enables fast paths
 * that skip block scanning and/or inline parsing when new content
 * is a continuation of the current block.
 *
 * @module streaming/state
 */

import type { AssembleOpts } from "../assembler/assemble";
import type { BlockKindValue } from "../scanner/block/types";
import { BlockKind } from "../scanner/block/types";
import type { LinkReference } from "../types/internal";
import type { InlineToken, Token } from "../types/tokens";

/** Internal streaming state persisted between parse calls. */
export interface StreamState {
  prevLen: number;
  opts: AssembleOpts;
  completedTokens: Array<Token>;
  activeBlockStart: number;
  refMap: Map<string, LinkReference>;
  /** Kind of the last active block — enables fast paths. */
  activeBlockKind: BlockKindValue;
  /** Content start of the active block (offset into full source). */
  activeContentStart: number;
  /** Fence char code for fenced code / math blocks (0 if not applicable). */
  activeFenceChar: number;
  /** Fence length for fenced code blocks (0 if not applicable). */
  activeFenceLen: number;
  /** Language string for fenced code blocks. */
  activeLang: string;
  /** Info string for fenced code blocks. */
  activeInfo: string;
  /** Cached inline tokens from the last paragraph parse (for text-append fast path). */
  activeInlines: Array<InlineToken> | null;
}

/** Create initial streaming state after a full parse. */
export function createInitialState(srcLen: number, opts: AssembleOpts): StreamState {
  return {
    prevLen: srcLen,
    opts,
    completedTokens: [],
    activeBlockStart: 0,
    refMap: new Map(),
    activeBlockKind: BlockKind.Paragraph,
    activeContentStart: 0,
    activeFenceChar: 0,
    activeFenceLen: 0,
    activeLang: "",
    activeInfo: "",
    activeInlines: null,
  };
}

/** Reset active block state to defaults. */
export function resetActiveState(state: StreamState): void {
  state.activeBlockKind = BlockKind.Paragraph;
  state.activeContentStart = 0;
  state.activeFenceChar = 0;
  state.activeFenceLen = 0;
  state.activeLang = "";
  state.activeInfo = "";
  state.activeInlines = null;
}
