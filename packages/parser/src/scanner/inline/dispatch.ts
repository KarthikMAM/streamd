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

// Handler indices — H_TEXT (0) is the default, never referenced in switch
export const H_ESCAPE = 1;
export const H_CODE = 2;
export const H_DELIM = 3;
export const H_LINK = 4;
export const H_IMAGE = 5;
export const H_AUTOLINK = 6;
export const H_ENTITY = 7;
export const H_NEWLINE = 8;
export const H_MATH = 9;
export const H_GFM_AUTOLINK = 10;

/** Build the dispatch table for the given feature flags. */
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

/** Dispatch table cache keyed by (math, autolinks, strikethrough) bitmask. */
const DISPATCH_CACHE: Array<Uint8Array | undefined> = [];

/** Select or build the dispatch table for the given flags. */
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
