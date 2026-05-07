/**
 * Internal mutable records used during parsing.
 *
 * NOT part of the public API — consumed only by scanner, resolver, assembler.
 * All records created via factory functions with ALL fields initialized in
 * fixed order for monomorphic hidden classes.
 *
 * @module types/internal
 */
import type { InlineToken } from "./tokens";

/**
 * InlineNode — first-pass inline scan output.
 *
 * Represents a single element in the inline node pool: either a resolved
 * token, an unresolved delimiter, or a dead (consumed) node.
 */
export interface InlineNode {
  /** Node classification: 0=token (resolved), 1=delimiter (pending), 2=dead (consumed). */
  kind: 0 | 1 | 2;
  /** Resolved inline token, or null for delimiter/dead nodes. */
  token: InlineToken | null;
  /** Delimiter character code (CC_STAR, CC_UNDERSCORE, CC_TILDE) — 0 for non-delimiters. */
  char: number;
  /** Run length of consecutive delimiter characters. */
  count: number;
  /** Whether this delimiter run can open emphasis/strong per spec §6.2 rules. */
  canOpen: boolean;
  /** Whether this delimiter run can close emphasis/strong per spec §6.2 rules. */
  canClose: boolean;
  /** Start offset in source string. */
  pos: number;
  /** End offset in source string (exclusive). */
  end: number;
}

/**
 * Shared scan result — reused by all inline sub-scanners.
 *
 * Module-level singleton mutated and returned by each scanner.
 * Caller must read `.token` and `.end` immediately before the next scan call.
 */
export interface ScanResult {
  /** The inline token produced by the scanner. */
  token: InlineToken;
  /** Offset past the last consumed character (exclusive). */
  end: number;
}

/**
 * LinkReference — stored in refMap (first definition wins per spec §4.7).
 */
export interface LinkReference {
  /** Resolved link destination URL. */
  destination: string;
  /** Optional link title (empty string if absent). */
  title: string;
}

/**
 * A half-open range of offsets into the source string.
 *
 * Used by table cell splitting, HTML tag scanning, and any other
 * utility that returns a start/end pair without allocating a substring.
 */
export interface SourceRange {
  /** Inclusive start offset. */
  start: number;
  /** Exclusive end offset. */
  end: number;
}
