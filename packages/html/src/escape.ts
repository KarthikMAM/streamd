/**
 * String-escaping helpers for HTML output.
 *
 * Performance exception: the inner `charCodeAt` / `slice` loops use index-based
 * iteration and are byte-at-a-time by design — these run on every rendered
 * text token on every streaming chunk. Rewriting as `Array#map` / regex would
 * measurably regress throughput.
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
  /** Accumulated Unicode codepoint value from the digit sequence. Range: 0–0x10FFFF. */
  readonly codepoint: number;
  /** Index into the source string immediately after the last consumed digit. */
  readonly next: number;
}

/** Character code for `&` — triggers entity-reference scanning. */
const CC_AMP = 38;
/** Character code for `<` — must be escaped in HTML body text. */
const CC_LT = 60;
/** Character code for `>` — must be escaped in HTML body text. */
const CC_GT = 62;
/** Character code for `"` — must be escaped inside attribute values. */
const CC_QUOT = 34;
/** Character code for `'` — escaped in attributes to prevent injection. */
const CC_APOS = 39;
/** Character code for `#` — signals a numeric entity reference after `&`. */
const CC_HASH = 35;
/** Character code for `;` — terminates an entity reference. */
const CC_SEMI = 59;
/** Character code for lowercase `x` — signals hex mode in `&#x…;`. */
const CC_X_L = 120;
/** Character code for uppercase `X` — signals hex mode in `&#X…;`. */
const CC_X_U = 88;
/** Character code for `0` — lower bound of decimal digit range. */
const CC_0 = 48;
/** Character code for `9` — upper bound of decimal digit range. */
const CC_9 = 57;
/** Character code for lowercase `a` — lower bound of lowercase alpha range. */
const CC_A_L = 97;
/** Character code for lowercase `f` — upper bound of lowercase hex digit range. */
const CC_F_L = 102;
/** Character code for lowercase `z` — upper bound of lowercase alpha range. */
const CC_Z_L = 122;
/** Character code for uppercase `A` — lower bound of uppercase alpha range. */
const CC_A_U = 65;
/** Character code for uppercase `F` — upper bound of uppercase hex digit range. */
const CC_F_U = 70;
/** Character code for uppercase `Z` — upper bound of uppercase alpha range. */
const CC_Z_U = 90;
/** Character code for ASCII space (0x20) — boundary for control characters. */
const CC_SPACE = 0x20;
/** Character code for DEL (0x7F) — must be percent-encoded in URLs. */
const CC_DEL = 0x7f;
/** Character code for `%` — signals an existing percent-escape in URLs. */
const CC_PERCENT = 0x25;
/** Start of the UTF-16 high-surrogate range (0xD800). */
const CC_HIGH_SURROGATE_START = 0xd800;
/** End of the UTF-16 high-surrogate range (0xDBFF). */
const CC_HIGH_SURROGATE_END = 0xdbff;
/** Maximum ASCII code point (0x7F) — bytes above this are percent-encoded. */
const CC_ASCII_MAX = 0x7f;
/** Maximum length of an HTML5 named entity name. Prevents unbounded scanning. */
const MAX_ENTITY_NAME_LENGTH = 32;
/** Maximum digits in a numeric entity. Prevents unbounded accumulation. */
const MAX_NUMERIC_ENTITY_DIGITS = 8;
/** Maximum valid Unicode codepoint (U+10FFFF). Values above are replaced with U+FFFD. */
const MAX_CODEPOINT = 0x10ffff;
/** Unicode replacement character (U+FFFD) — substituted for invalid codepoints. */
const REPLACEMENT_CODEPOINT = 0xfffd;

/** Radix for hexadecimal digit accumulation in `&#x…;` numeric entity scanning. */
const HEX_RADIX = 16;

/** Radix for decimal digit accumulation in `&#…;` numeric entity scanning. */
const DECIMAL_RADIX = 10;

/**
 * Escape a string for HTML body text (outside attributes and `<script>` /
 * `<style>` blocks).
 *
 * @param input - Raw text. Empty input returns `""`.
 * @returns Input with `<`, `>`, `&`, `"` replaced by named entities. Other
 *   characters pass through unchanged.
 */
export function escapeHtml(input: string): string {
  let out = "";
  let last = 0;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    const entity = bodyEntityFor(code);
    if (entity === null) continue;

    if (i > last) out += input.slice(last, i);
    out += entity;
    last = i + 1;
  }

  return last === 0 ? input : out + input.slice(last);
}

/** Map a char code to its body-text entity, or null when no escape is needed. */
function bodyEntityFor(code: number): string | null {
  if (code === CC_AMP) return "&amp;";
  if (code === CC_LT) return "&lt;";
  if (code === CC_GT) return "&gt;";
  if (code === CC_QUOT) return "&quot;";
  return null;
}

/**
 * Escape a string for an HTML attribute value delimited by double quotes.
 *
 * @param input - Raw attribute value. Empty input returns `""`.
 * @returns Input with `<`, `>`, `&`, `"`, `'` replaced by entity references.
 */
export function escapeAttr(input: string): string {
  let out = "";
  let last = 0;

  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    const entity = attrEntityFor(code);
    if (entity === null) continue;

    if (i > last) out += input.slice(last, i);
    out += entity;
    last = i + 1;
  }

  return last === 0 ? input : out + input.slice(last);
}

/** Map a char code to its attribute entity, or null when no escape is needed. */
function attrEntityFor(code: number): string | null {
  if (code === CC_AMP) return "&amp;";
  if (code === CC_QUOT) return "&quot;";
  if (code === CC_LT) return "&lt;";
  if (code === CC_GT) return "&gt;";
  if (code === CC_APOS) return "&#39;";
  return null;
}

/**
 * Minimal URL encoder matching CommonMark reference output.
 *
 * Percent-encodes spaces, controls, and non-ASCII bytes but preserves
 * already-encoded sequences (`%` followed by two hex digits) and structural
 * URL characters.
 *
 * @param url - Raw URL, possibly empty.
 * @returns URL with unsafe bytes percent-encoded. Returns input unchanged when
 *   nothing needs encoding.
 */
export function normalizeUrl(url: string): string {
  let out = "";
  let last = 0;

  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i);
    if (!needsEncoding(url, i, code)) continue;

    if (i > last) out += url.slice(last, i);
    out += percentEncodeCodePoint(url, i, code);
    if (isHighSurrogate(code) && i + 1 < url.length) i++;
    last = i + 1;
  }

  return last === 0 ? url : out + url.slice(last);
}

/** True when the byte/codepoint at position `i` should be percent-encoded. */
function needsEncoding(url: string, i: number, code: number): boolean {
  if (code === CC_PERCENT) return !isPercentEscape(url, i);
  if (code === CC_SPACE) return true;
  if (code < CC_SPACE || code === CC_DEL) return true;
  if (code > CC_ASCII_MAX) return true;
  return false;
}

/** True when `url[i..i+3]` is a valid `%HH` escape sequence. */
function isPercentEscape(url: string, i: number): boolean {
  if (i + 2 >= url.length) return false;
  return isHex(url.charCodeAt(i + 1)) && isHex(url.charCodeAt(i + 2));
}

/** True when the code is a hex digit (0-9, a-f, A-F). */
function isHex(code: number): boolean {
  if (code >= CC_0 && code <= CC_9) return true;
  if (code >= CC_A_L && code <= CC_F_L) return true;
  if (code >= CC_A_U && code <= CC_F_U) return true;
  return false;
}

/** UTF-8 encode the code point at `url[i]` and return its %-escaped bytes. */
function percentEncodeCodePoint(url: string, i: number, code: number): string {
  if (code < 0x80) return encodeByte(code);

  const codepoint = isHighSurrogate(code) ? (url.codePointAt(i) ?? code) : code;
  const bytes = utf8Bytes(codepoint);
  let encoded = "";
  for (let j = 0; j < bytes.length; j++) encoded += encodeByte(bytes[j] ?? 0);

  return encoded;
}

/** True if `code` is the leading half of a surrogate pair. */
function isHighSurrogate(code: number): boolean {
  return code >= CC_HIGH_SURROGATE_START && code <= CC_HIGH_SURROGATE_END;
}

/** Encode a single byte as `%HH` uppercase hex. */
function encodeByte(byte: number): string {
  const hex = byte.toString(16).toUpperCase();
  return hex.length === 1 ? `%0${hex}` : `%${hex}`;
}

/** Convert a Unicode code point to its UTF-8 byte sequence. */
function utf8Bytes(codepoint: number): Array<number> {
  if (codepoint < 0x80) return [codepoint];
  if (codepoint < 0x800) return [0xc0 | (codepoint >> 6), 0x80 | (codepoint & 0x3f)];
  if (codepoint < 0x10000) {
    return [0xe0 | (codepoint >> 12), 0x80 | ((codepoint >> 6) & 0x3f), 0x80 | (codepoint & 0x3f)];
  }
  return [
    0xf0 | (codepoint >> 18),
    0x80 | ((codepoint >> 12) & 0x3f),
    0x80 | ((codepoint >> 6) & 0x3f),
    0x80 | (codepoint & 0x3f),
  ];
}

/**
 * Decode HTML entity references in a text string.
 *
 * Handles named entities via the HTML5 table and numeric entities (decimal
 * and hex). Unknown or malformed references pass through unchanged.
 *
 * The parser already decodes numeric entities inside text content, but
 * named entities are passed through raw. This function fills the gap.
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

/** Result of a single successful entity decode: the replacement + next index. */
interface EntityDecodeResult {
  /** Decoded Unicode string to substitute for the entity reference. */
  readonly decoded: string;
  /** Index into the source string immediately after the closing `;`. */
  readonly end: number;
}

/**
 * Try to decode one entity reference starting at `&` position `start`.
 *
 * @returns Decode result, or null when the reference is malformed or unknown.
 */
function tryDecodeReference(input: string, start: number): EntityDecodeResult | null {
  const nextChar = input.charCodeAt(start + 1);
  if (nextChar === CC_HASH) return scanNumericEntity(input, start + 2, input.length);
  if (isAlphaNum(nextChar)) return scanNamedEntity(input, start + 1, input.length);
  return null;
}

/** Scan a `&name;` reference and look the name up in the HTML5 table. */
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

/** Scan a `&#n;` or `&#xh;` reference and decode the code point. */
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

/** True when the char at `i` is the `x`/`X` flag of a hex entity. */
function detectHexReference(input: string, i: number, end: number): boolean {
  if (i >= end) return false;
  const code = input.charCodeAt(i);
  return code === CC_X_L || code === CC_X_U;
}

/** Read digits up to the numeric-entity limit; returns accumulator and stop index. */
function readDigits(input: string, start: number, end: number, hex: boolean): NumericEntityScan {
  let i = start;
  let codepoint = 0;
  const radix = hex ? HEX_RADIX : DECIMAL_RADIX;

  while (i < end && i - start < MAX_NUMERIC_ENTITY_DIGITS) {
    const code = input.charCodeAt(i);
    const digit = hex ? hexValue(code) : decValue(code);
    if (digit < 0) break;
    codepoint = codepoint * radix + digit;
    i++;
  }

  return { codepoint, next: i };
}

/** Decimal digit value, or -1 if not a digit. */
function decValue(code: number): number {
  if (code >= CC_0 && code <= CC_9) return code - CC_0;
  return -1;
}

/** Hex digit value, or -1 if not a hex digit. */
function hexValue(code: number): number {
  if (code >= CC_0 && code <= CC_9) return code - CC_0;
  if (code >= CC_A_L && code <= CC_F_L) return code - CC_A_L + 10;
  if (code >= CC_A_U && code <= CC_F_U) return code - CC_A_U + 10;
  return -1;
}

/** True for ASCII alphanumerics. */
function isAlphaNum(code: number): boolean {
  if (code >= CC_0 && code <= CC_9) return true;
  if (code >= CC_A_L && code <= CC_Z_L) return true;
  if (code >= CC_A_U && code <= CC_Z_U) return true;
  return false;
}
