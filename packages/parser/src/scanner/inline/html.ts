/**
 * Inline HTML scanner — spec §6.6.
 *
 * Dispatches to sub-scanners for open tags, close tags, comments,
 * processing instructions, declarations, and CDATA sections.
 * All matching via charCode state machines — zero regex.
 *
 * @module scanner/inline/html
 */

import type { ScanResult } from "../../types/internal";
import type { InlineToken } from "../../types/tokens";
import { createHtmlInlineToken } from "../../utils/token-factory";
import {
  CC_0,
  CC_9,
  CC_A_UPPER,
  CC_BACKTICK,
  CC_BANG,
  CC_C_UPPER,
  CC_COLON,
  CC_D_UPPER,
  CC_DASH,
  CC_DOT,
  CC_DQUOTE,
  CC_EQ,
  CC_GT,
  CC_LBRACKET,
  CC_LF,
  CC_LT,
  CC_QMARK,
  CC_RBRACKET,
  CC_SLASH,
  CC_SPACE,
  CC_SQUOTE,
  CC_T_UPPER,
  CC_TAB,
  CC_UNDERSCORE,
} from "../constants";
import { isAlpha, isAsciiWhitespace } from "../utils";

/** Shared result — mutated and returned. Caller must read immediately. */
const RESULT = { token: null as unknown as InlineToken, end: 0 };

/**
 * Scan inline HTML starting at `<`.
 *
 * @returns Shared result or null. Caller must read immediately.
 */
export function scanHtmlInline(src: string, pos: number, end: number): ScanResult | null {
  if (pos + 1 >= end) return null;

  const next = src.charCodeAt(pos + 1);

  // Close tag: `</tagname>`
  if (next === CC_SLASH) {
    return emitSlice(src, pos, scanCloseTag(src, pos, end));
  }

  // Comment: `<!-- ... -->`
  if (next === CC_BANG) {
    if (
      pos + 3 < end &&
      src.charCodeAt(pos + 2) === CC_DASH &&
      src.charCodeAt(pos + 3) === CC_DASH
    ) {
      return emitSlice(src, pos, scanHtmlComment(src, pos, end));
    }

    // CDATA: `<![CDATA[ ... ]]>`
    if (
      pos + 8 < end &&
      src.charCodeAt(pos + 2) === CC_LBRACKET &&
      src.charCodeAt(pos + 3) === CC_C_UPPER &&
      src.charCodeAt(pos + 4) === CC_D_UPPER &&
      src.charCodeAt(pos + 5) === CC_A_UPPER &&
      src.charCodeAt(pos + 6) === CC_T_UPPER &&
      src.charCodeAt(pos + 7) === CC_A_UPPER &&
      src.charCodeAt(pos + 8) === CC_LBRACKET
    ) {
      return emitSlice(src, pos, scanCdata(src, pos, end));
    }

    // Declaration: `<!LETTER ... >`
    if (pos + 2 < end && isAlpha(src.charCodeAt(pos + 2))) {
      return emitSlice(src, pos, scanDeclaration(src, pos, end));
    }

    return null;
  }

  // Processing instruction: `<? ... ?>`
  if (next === CC_QMARK) {
    return emitSlice(src, pos, scanProcessingInstruction(src, pos, end));
  }

  // Open tag: `<tagname ...>`
  if (isAlpha(next)) {
    return emitSlice(src, pos, scanOpenTag(src, pos, end));
  }

  return null;
}

/**
 * If `scanEnd > 0`, emit an HtmlInlineToken for `src[pos..scanEnd)`.
 * Consolidates the repeated emit pattern across inline HTML sub-scanners.
 *
 * @param src - Source string
 * @param pos - Start position of the HTML construct
 * @param scanEnd - End position from the sub-scanner, or -1/0 on failure
 * @returns Shared result or null
 */
function emitSlice(src: string, pos: number, scanEnd: number): ScanResult | null {
  if (scanEnd <= 0) return null;

  RESULT.token = createHtmlInlineToken(src.slice(pos, scanEnd));
  RESULT.end = scanEnd;
  return RESULT;
}

/**
 * Check if a charCode is valid in an HTML tag name after the first character.
 *
 * @param code - Character code to test
 * @returns True if alphanumeric or dash
 */
function isTagNameChar(code: number): boolean {
  return isAlpha(code) || (code >= CC_0 && code <= CC_9) || code === CC_DASH;
}

/**
 * Check if a charCode can start an HTML attribute name.
 *
 * @param code - Character code to test
 * @returns True if alpha, underscore, or colon
 */
function isAttrNameStart(code: number): boolean {
  return isAlpha(code) || code === CC_UNDERSCORE || code === CC_COLON;
}

/**
 * Check if a charCode is valid in an HTML attribute name.
 *
 * @param code - Character code to test
 * @returns True if valid in attribute name position
 */
function isAttrNameChar(code: number): boolean {
  return (
    isAlpha(code) ||
    (code >= CC_0 && code <= CC_9) ||
    code === CC_UNDERSCORE ||
    code === CC_DOT ||
    code === CC_COLON ||
    code === CC_DASH
  );
}

/**
 * Check if a charCode terminates an unquoted attribute value.
 *
 * @param code - Character code to test
 * @returns True if the character ends an unquoted value
 */
function isUnquotedStop(code: number): boolean {
  return (
    code === CC_SPACE ||
    code === CC_TAB ||
    code === CC_LF ||
    code === CC_DQUOTE ||
    code === CC_SQUOTE ||
    code === CC_EQ ||
    code === CC_LT ||
    code === CC_GT ||
    code === CC_BACKTICK
  );
}

/**
 * Scan an open tag `<tagname attrs?>` or self-closing `<tagname attrs?/>`.
 *
 * @param src - Source string
 * @param pos - Position of the `<` character
 * @param end - End boundary
 * @returns End position past the `>`, or -1 on failure
 */
function scanOpenTag(src: string, pos: number, end: number): number {
  let i = pos + 1;

  if (!isAlpha(src.charCodeAt(i))) return -1;
  i++;
  while (i < end && isTagNameChar(src.charCodeAt(i))) i++;

  while (i < end) {
    const wsStart = i;
    while (i < end && isAsciiWhitespace(src.charCodeAt(i))) i++;

    const code = src.charCodeAt(i);

    if (code === CC_GT) return i + 1;
    if (code === CC_SLASH) {
      return i + 1 < end && src.charCodeAt(i + 1) === CC_GT ? i + 2 : -1;
    }

    if (i === wsStart) return -1;

    if (!isAttrNameStart(src.charCodeAt(i))) return -1;
    i++;
    while (i < end && isAttrNameChar(src.charCodeAt(i))) i++;

    while (i < end && isAsciiWhitespace(src.charCodeAt(i))) i++;

    if (i < end && src.charCodeAt(i) === CC_EQ) {
      i++;
      while (i < end && isAsciiWhitespace(src.charCodeAt(i))) i++;
      if (i >= end) return -1;

      const valCode = src.charCodeAt(i);

      if (valCode === CC_DQUOTE || valCode === CC_SQUOTE) {
        i++;
        while (i < end && src.charCodeAt(i) !== valCode) i++;
        if (i >= end) return -1;
        i++;
      } else {
        while (i < end && !isUnquotedStop(src.charCodeAt(i))) i++;
      }
    }
  }

  return -1;
}

/**
 * Scan a close tag `</tagname>`.
 *
 * @param src - Source string
 * @param pos - Position of the `<` character
 * @param end - End boundary
 * @returns End position past the `>`, or -1 on failure
 */
function scanCloseTag(src: string, pos: number, end: number): number {
  let i = pos + 2;

  if (i >= end || !isAlpha(src.charCodeAt(i))) return -1;
  i++;
  while (i < end && isTagNameChar(src.charCodeAt(i))) i++;

  while (i < end && isAsciiWhitespace(src.charCodeAt(i))) i++;

  if (i >= end || src.charCodeAt(i) !== CC_GT) return -1;
  return i + 1;
}

/**
 * Scan an HTML comment `<!-- ... -->` (not `<!-->` or `<!--->` per spec).
 *
 * @param src - Source string
 * @param pos - Position of the `<` character
 * @param end - End boundary
 * @returns End position past `-->`, or -1 on failure
 */
function scanHtmlComment(src: string, pos: number, end: number): number {
  let i = pos + 4;
  if (i >= end) return -1;

  if (src.charCodeAt(i) === CC_GT) return -1;
  if (src.charCodeAt(i) === CC_DASH && i + 1 < end && src.charCodeAt(i + 1) === CC_GT) return -1;

  while (i < end - 2) {
    if (
      src.charCodeAt(i) === CC_DASH &&
      src.charCodeAt(i + 1) === CC_DASH &&
      src.charCodeAt(i + 2) === CC_GT
    ) {
      return i + 3;
    }
    i++;
  }

  return -1;
}

/**
 * Scan a processing instruction `<? ... ?>`.
 *
 * @param src - Source string
 * @param pos - Position of the `<` character
 * @param end - End boundary
 * @returns End position past `?>`, or -1 on failure
 */
function scanProcessingInstruction(src: string, pos: number, end: number): number {
  let i = pos + 2;

  while (i < end - 1) {
    if (src.charCodeAt(i) === CC_QMARK && src.charCodeAt(i + 1) === CC_GT) return i + 2;
    i++;
  }

  return -1;
}

/**
 * Scan an HTML declaration `<!LETTER ... >`.
 *
 * @param src - Source string
 * @param pos - Position of the `<` character
 * @param end - End boundary
 * @returns End position past `>`, or -1 on failure
 */
function scanDeclaration(src: string, pos: number, end: number): number {
  let i = pos + 2;

  while (i < end && isAlpha(src.charCodeAt(i))) i++;

  if (i >= end || !isAsciiWhitespace(src.charCodeAt(i))) return -1;

  while (i < end) {
    if (src.charCodeAt(i) === CC_GT) return i + 1;
    i++;
  }

  return -1;
}

/**
 * Scan a CDATA section `<![CDATA[ ... ]]>`.
 *
 * @param src - Source string
 * @param pos - Position of the `<` character
 * @param end - End boundary
 * @returns End position past `]]>`, or -1 on failure
 */
function scanCdata(src: string, pos: number, end: number): number {
  let i = pos + 9;

  while (i < end - 2) {
    if (
      src.charCodeAt(i) === CC_RBRACKET &&
      src.charCodeAt(i + 1) === CC_RBRACKET &&
      src.charCodeAt(i + 2) === CC_GT
    ) {
      return i + 3;
    }
    i++;
  }

  return -1;
}
