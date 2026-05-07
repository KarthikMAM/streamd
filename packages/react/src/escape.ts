/**
 * Entity-decoding helper for the React renderer.
 *
 * React's JSX runtime auto-escapes any string it embeds into the DOM: given
 * a Text-token content of the 5 literal characters `&amp;`, JSX will emit
 * `&amp;amp;` (the ampersand itself gets re-escaped). The HTML renderer in
 * `@streamd/html`, by contrast, runs `escapeHtml(decodeEntities(content))`
 * before emitting text — its effective pipeline is "decode the token's raw
 * content back to its display form, then escape for HTML body context".
 *
 * To match that behaviour, the React renderer also decodes entity references
 * in Text-token content before passing it to the user-supplied `text`
 * component, and JSX's auto-escape then plays the role of `escapeHtml`. The
 * net effect is byte-for-byte parity with the HTML renderer's output for all
 * text tokens that contain named or numeric entity references.
 *
 * ## Duplication note
 *
 * This is a verbatim copy of the `decodeEntities` function and its private
 * helpers from `packages/html/src/escape.ts`. It intentionally does not add
 * a runtime dependency on `@streamd/html`:
 *
 *   - `@streamd/html` ships a full HTML renderer plus its own bundle; pulling
 *     it into every `@streamd/react` consumer just to import one pure helper
 *     bloats bundle size by ~100 KB of unrelated code.
 *   - `decodeEntities` + `lookupEntity` + the packed entity table are pure
 *     functions. Duplicating them is the smaller evil.
 *
 * If the decode semantics ever change, update `@streamd/html`'s copy in
 * lockstep. Both packages ship unit tests that exercise this path.
 *
 * @module escape
 */

import { lookupEntity } from "./entities";

/**
 * Result of scanning a numeric character-reference body — `&#…;` or
 * `&#x…;`. The scanner returns the accumulated codepoint plus the
 * index after the last consumed digit.
 */
interface NumericEntityScan {
  /** Accumulated Unicode codepoint value from the digit sequence. */
  readonly codepoint: number;
  /** Index in the input string immediately after the last consumed digit. */
  readonly next: number;
}

/** Result of a single successful entity decode: the replacement + next index. */
interface EntityDecodeResult {
  /** Decoded Unicode string that replaces the entity reference. */
  readonly decoded: string;
  /** Index in the input string immediately after the closing `;`. */
  readonly end: number;
}

/** Char code for `&` — entity reference opener. */
const CC_AMP = 38;
/** Char code for `#` — numeric entity prefix. */
const CC_HASH = 35;
/** Char code for `;` — entity reference closer. */
const CC_SEMI = 59;
/** Char code for lowercase `x` — hex entity flag. */
const CC_X_L = 120;
/** Char code for uppercase `X` — hex entity flag. */
const CC_X_U = 88;
/** Char code for `0`. */
const CC_0 = 48;
/** Char code for `9`. */
const CC_9 = 57;
/** Char code for lowercase `a`. */
const CC_A_L = 97;
/** Char code for lowercase `f` — hex digit upper bound. */
const CC_F_L = 102;
/** Char code for lowercase `z` — alpha upper bound. */
const CC_Z_L = 122;
/** Char code for uppercase `A`. */
const CC_A_U = 65;
/** Char code for uppercase `F` — hex digit upper bound. */
const CC_F_U = 70;
/** Char code for uppercase `Z` — alpha upper bound. */
const CC_Z_U = 90;
/** Maximum length of a named entity name (guards against unbounded scanning). */
const MAX_ENTITY_NAME_LENGTH = 32;
/** Maximum digits in a numeric entity (guards against overflow). */
const MAX_NUMERIC_ENTITY_DIGITS = 8;
/** Maximum valid Unicode codepoint (U+10FFFF). */
const MAX_CODEPOINT = 0x10ffff;
/** Unicode replacement character codepoint (U+FFFD) — used for invalid/zero codepoints. */
const REPLACEMENT_CODEPOINT = 0xfffd;

/**
 * Decode HTML entity references in a text string.
 *
 * Handles named entities via the HTML5 table and numeric entities (decimal
 * and hex). Unknown or malformed references pass through unchanged.
 *
 * The parser already decodes numeric entities inside text content, but
 * named entities are passed through raw. This function fills the gap so
 * the React renderer's text output matches `@streamd/html` for all
 * entity-containing inputs.
 *
 * @param input - Raw text. Empty input returns `""`.
 * @returns Input with all recognized `&name;` / `&#n;` sequences replaced
 *   by their decoded characters.
 */
export function decodeEntities(input: string): string {
  if (input.indexOf("&") === -1) return input;
  let out = "";
  let i = 0;
  while (i < input.length) {
    const code = input.charCodeAt(i);
    if (code !== CC_AMP) {
      out += input.charAt(i);
      i++;
      continue;
    }
    const consumed = tryDecodeReference(input, i);
    if (consumed === null) {
      out += "&";
      i++;
      continue;
    }
    out += consumed.decoded;
    i = consumed.end;
  }
  return out;
}

/**
 * Try to decode one entity reference starting at `&` position `start`.
 *
 * @param input - Full input string being scanned.
 * @param start - Index of the `&` that opens the reference.
 * @returns Decode result, or null when the reference is malformed or unknown.
 */
function tryDecodeReference(input: string, start: number): EntityDecodeResult | null {
  const nextChar = input.charCodeAt(start + 1);
  if (nextChar === CC_HASH) return scanNumericEntity(input, start + 2, input.length);
  if (isAlphaNum(nextChar)) return scanNamedEntity(input, start + 1, input.length);
  return null;
}

/**
 * Scan a `&name;` reference and look the name up in the HTML5 table.
 *
 * @param input - Full input string being scanned.
 * @param start - Index of the first name character (just after `&`).
 * @param end - Exclusive upper bound for the scan.
 * @returns Decode result with the decoded text and index after `;`, or null
 *   when the name is unknown or the reference is malformed.
 */
function scanNamedEntity(input: string, start: number, end: number): EntityDecodeResult | null {
  const maxEnd = Math.min(end, start + MAX_ENTITY_NAME_LENGTH);
  for (let i = start; i < maxEnd; i++) {
    const code = input.charCodeAt(i);
    if (code === CC_SEMI) {
      const name = input.slice(start, i);
      const decoded = lookupEntity(name);
      if (decoded === null) return null;
      return { decoded, end: i + 1 };
    }
    if (!isAlphaNum(code)) return null;
  }
  return null;
}

/**
 * Scan a `&#n;` or `&#xh;` reference and decode the code point.
 *
 * @param input - Full input string being scanned.
 * @param start - Index of the character just after `&#`.
 * @param end - Exclusive upper bound for the scan.
 * @returns Decode result with the decoded code point and index after `;`,
 *   or null when the reference is malformed.
 */
function scanNumericEntity(input: string, start: number, end: number): EntityDecodeResult | null {
  let i = start;
  const isHexReference = detectHexReference(input, i, end);
  if (isHexReference) i++;
  const digitStart = i;
  const { codepoint, next } = readDigits(input, i, end, isHexReference);
  if (next === digitStart) return null;
  if (next >= end || input.charCodeAt(next) !== CC_SEMI) return null;
  const finalPoint =
    codepoint === 0 || codepoint > MAX_CODEPOINT ? REPLACEMENT_CODEPOINT : codepoint;
  return { decoded: String.fromCodePoint(finalPoint), end: next + 1 };
}

/**
 * Detect whether the character at position `i` is the `x` or `X` flag
 * that marks a hexadecimal numeric entity (`&#x…;`).
 *
 * @param input - Full input string being scanned.
 * @param i - Index to inspect.
 * @param end - Exclusive upper bound for the scan.
 * @returns `true` when the char at `i` is `x` or `X`; `false` otherwise.
 */
function detectHexReference(input: string, i: number, end: number): boolean {
  if (i >= end) return false;
  const code = input.charCodeAt(i);
  return code === CC_X_L || code === CC_X_U;
}

/**
 * Read decimal or hex digits from `start` up to the numeric-entity digit
 * limit, accumulating the numeric value.
 *
 * @param input - Full input string being scanned.
 * @param start - Index of the first potential digit character.
 * @param end - Exclusive upper bound for the scan.
 * @param hex - When `true`, parse hex digits; otherwise decimal.
 * @returns A {@link NumericEntityScan} with the accumulated codepoint and
 *   the index after the last consumed digit.
 */
function readDigits(input: string, start: number, end: number, hex: boolean): NumericEntityScan {
  let i = start;
  let codepoint = 0;
  while (i < end && i - start < MAX_NUMERIC_ENTITY_DIGITS) {
    const code = input.charCodeAt(i);
    const digit = hex ? hexValue(code) : decValue(code);
    if (digit < 0) break;
    codepoint = codepoint * (hex ? 16 : 10) + digit;
    i++;
  }
  return { codepoint, next: i };
}

/**
 * Convert an ASCII char code to its decimal digit value.
 *
 * @param code - Character code to evaluate.
 * @returns The digit value 0–9, or `-1` when `code` is not a decimal digit.
 */
function decValue(code: number): number {
  if (code >= CC_0 && code <= CC_9) return code - CC_0;
  return -1;
}

/**
 * Convert an ASCII char code to its hexadecimal digit value.
 *
 * @param code - Character code to evaluate.
 * @returns The digit value 0–15, or `-1` when `code` is not a hex digit.
 */
function hexValue(code: number): number {
  if (code >= CC_0 && code <= CC_9) return code - CC_0;
  if (code >= CC_A_L && code <= CC_F_L) return code - CC_A_L + 10;
  if (code >= CC_A_U && code <= CC_F_U) return code - CC_A_U + 10;
  return -1;
}

/**
 * Test whether a character code is an ASCII alphanumeric (0–9, a–z, A–Z).
 *
 * @param code - Character code to evaluate.
 * @returns `true` when the code falls within one of the three ASCII
 *   alphanumeric ranges; `false` otherwise.
 */
function isAlphaNum(code: number): boolean {
  if (code >= CC_0 && code <= CC_9) return true;
  if (code >= CC_A_L && code <= CC_Z_L) return true;
  if (code >= CC_A_U && code <= CC_Z_U) return true;
  return false;
}
