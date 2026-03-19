/**
 * Parser configuration options and result types.
 *
 * All extensions default to false — opt-in only.
 *
 * @module types/options
 */
import type { TokensList } from "./tokens";

export interface ParseOptions {
  /** Enable all GFM extensions at once. Default: false */
  gfm?: boolean;
  /** Enable GFM tables. Default: false (or follows gfm) */
  tables?: boolean;
  /** Enable GFM strikethrough. Default: false (or follows gfm) */
  strikethrough?: boolean;
  /** Enable GFM task list items. Default: false (or follows gfm) */
  taskListItems?: boolean;
  /** Enable GFM autolinks. Default: false (or follows gfm) */
  autolinks?: boolean;
  /** Enable math ($..$ inline, $$...$$ block). Default: false */
  math?: boolean;
}

/**
 * Opaque parser state for streaming continuation.
 * Pass back as the second argument to parse() for incremental parsing.
 * Single-use: do not share, fork, or retain across multiple parse calls.
 */
export interface ParserState {
  /** @internal — brand to prevent accidental construction */
  readonly _brand: "ParserState";
}

export interface ParseResult {
  /** All tokens: stable (finalized) + speculative (auto-closed open blocks) */
  tokens: TokensList;
  /** tokens[0..stableCount-1] are FINAL — will never change in future chunks */
  stableCount: number;
  /** Pass back for streaming continuation */
  state: ParserState;
}
