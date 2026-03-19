/**
 * Character classification and whitespace utilities.
 *
 * Shared by inline scanners, block-html, and references.
 * All functions use charCode comparisons — zero regex.
 * Hot-path functions are kept small (≤10 lines) for JIT inlining.
 *
 * @module scanner/utils
 */
import {
  CC_A_LOWER,
  CC_A_UPPER,
  CC_LF,
  CC_SPACE,
  CC_TAB,
  CC_Z_LOWER,
  CC_Z_UPPER,
  CF_PUNCTUATION,
  CF_WHITESPACE,
  CHAR_TABLE,
} from "./constants";

/**
 * Check if a charCode is ASCII whitespace: space, tab, or line feed.
 *
 * Used by inline-link and references for whitespace skipping that
 * includes newlines (unlike {@link skipSpaces} which only skips space/tab).
 */
export function isAsciiWhitespace(code: number): boolean {
  return code === CC_SPACE || code === CC_TAB || code === CC_LF;
}

/**
 * Check if a charCode is an ASCII letter (a-z or A-Z).
 *
 * Shared by block-html and inline-html tag name scanning.
 */
export function isAlpha(code: number): boolean {
  return (code >= CC_A_LOWER && code <= CC_Z_LOWER) || (code >= CC_A_UPPER && code <= CC_Z_UPPER);
}

/**
 * Check if a charCode is an ASCII punctuation character per spec §2.1.
 *
 * Uses CHAR_TABLE bitmask lookup — O(1).
 */
export function isPunctuation(code: number): boolean {
  return code < 128 && (CHAR_TABLE[code] & CF_PUNCTUATION) !== 0;
}

/**
 * Check if a charCode is Unicode whitespace per spec §2.1.
 *
 * Covers ASCII whitespace via CHAR_TABLE, plus Unicode Zs general category.
 */
export function isUnicodeWhitespace(code: number): boolean {
  if (code < 128) return (CHAR_TABLE[code] & CF_WHITESPACE) !== 0;

  if (code === 0x00a0 || code === 0x1680 || code === 0x202f || code === 0x205f || code === 0x3000) {
    return true;
  }

  return code >= 0x2000 && code <= 0x200a;
}

/**
 * Skip forward past spaces and tabs. Returns new position.
 */
export function skipSpaces(src: string, pos: number, max: number): number {
  while (pos < max) {
    const code = src.charCodeAt(pos);
    if (code !== CC_SPACE && code !== CC_TAB) break;
    pos++;
  }
  return pos;
}
