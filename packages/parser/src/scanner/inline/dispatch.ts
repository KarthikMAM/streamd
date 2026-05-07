/**
 * Inline dispatch table — maps ASCII charCodes to handler indices.
 *
 * Parameterized by feature flags (math, autolinks, strikethrough).
 * Lazily cached per combination (3-bit key, up to 8 variants).
 *
 * @module scanner/inline/dispatch
 */
import {
  CC_AMP,
  CC_BACKSLASH,
  CC_BACKTICK,
  CC_BANG,
  CC_DOLLAR,
  CC_H_LOWER,
  CC_LBRACKET,
  CC_LF,
  CC_LT,
  CC_STAR,
  CC_TILDE,
  CC_UNDERSCORE,
  CC_W_LOWER,
} from "../constants";

/**
 * Inline handler indices — dense integers for dispatch table entries.
 * H_TEXT (0) is the implicit default and never appears in switch cases.
 * @group Handler Indices
 */

/** Handler: backslash escape (`\`). */
export const H_ESCAPE = 1;
/** Handler: code span (`` ` ``). */
export const H_CODE = 2;
/** Handler: emphasis/strikethrough delimiter (`*`, `_`, `~`). */
export const H_DELIM = 3;
/** Handler: link opener (`[`). */
export const H_LINK = 4;
/** Handler: image opener (`!`). */
export const H_IMAGE = 5;
/** Handler: spec autolink (`<`). */
export const H_AUTOLINK = 6;
/** Handler: HTML entity (`&`). */
export const H_ENTITY = 7;
/** Handler: newline (softbreak/hardbreak). */
export const H_NEWLINE = 8;
/** Handler: inline math (`$`). */
export const H_MATH = 9;
/** Handler: GFM extended autolink (`h`, `w` prefix). */
export const H_GFM_AUTOLINK = 10;

/**
 * Build the dispatch table for the given feature flags.
 *
 * Allocates a fresh Uint8Array(128) and populates handler indices for
 * each markdown-special character. Conditional entries (math, autolinks,
 * strikethrough) are only set when the corresponding flag is true.
 *
 * @param math - Enable `$` → H_MATH mapping
 * @param autolinks - Enable `h`/`w` → H_GFM_AUTOLINK mapping
 * @param strikethrough - Enable `~` → H_DELIM mapping
 * @returns Fresh dispatch table with handler indices populated
 */
function buildInlineDispatch(
  math: boolean,
  autolinks: boolean,
  strikethrough: boolean,
): Uint8Array {
  const table = new Uint8Array(128);
  table[CC_BACKSLASH] = H_ESCAPE;
  table[CC_BACKTICK] = H_CODE;
  table[CC_STAR] = H_DELIM;
  table[CC_UNDERSCORE] = H_DELIM;
  if (strikethrough) table[CC_TILDE] = H_DELIM;
  table[CC_LBRACKET] = H_LINK;
  table[CC_BANG] = H_IMAGE;
  table[CC_LT] = H_AUTOLINK;
  table[CC_AMP] = H_ENTITY;
  table[CC_LF] = H_NEWLINE;
  if (math) table[CC_DOLLAR] = H_MATH;
  if (autolinks) {
    table[CC_H_LOWER] = H_GFM_AUTOLINK;
    table[CC_W_LOWER] = H_GFM_AUTOLINK;
  }
  return table;
}

/**
 * Dispatch table cache keyed by (math, autolinks, strikethrough) bitmask.
 *
 * Module-level because dispatch tables are stateless and immutable once built.
 * Sharing across all parse calls avoids redundant allocation — at most 8
 * variants exist (2^3 feature flag combinations).
 */
const DISPATCH_CACHE: Array<Uint8Array | undefined> = [];

/**
 * Select or build the dispatch table for the given feature flags.
 *
 * Returns a cached Uint8Array(128) mapping ASCII codes to handler indices.
 * Builds on first access for each flag combination, then reuses from cache.
 *
 * @param math - Whether inline math (`$...$`) is enabled
 * @param autolinks - Whether GFM extended autolinks are enabled
 * @param strikethrough - Whether GFM strikethrough (`~~`) is enabled
 * @returns Uint8Array dispatch table for the inline scanner loop
 */
export function selectDispatch(
  math: boolean,
  autolinks: boolean,
  strikethrough: boolean,
): Uint8Array {
  const key = (math ? 1 : 0) | (autolinks ? 2 : 0) | (strikethrough ? 4 : 0);
  let table = DISPATCH_CACHE[key];
  if (!table) {
    table = buildInlineDispatch(math, autolinks, strikethrough);
    DISPATCH_CACHE[key] = table;
  }
  return table;
}
