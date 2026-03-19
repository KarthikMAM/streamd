/**
 * Autolink scanner — spec §6.5 and GFM autolinks.
 *
 * Zero regex — all matching via charCode comparisons and named constants.
 *
 * @module scanner/inline/autolink
 */

import type { ScanResult } from "../../types/internal";
import type { InlineToken } from "../../types/tokens";
import { createLinkToken, createTextToken } from "../../utils/token-factory";
import {
  CC_0,
  CC_9,
  CC_AMP,
  CC_AT,
  CC_BACKTICK,
  CC_BANG,
  CC_CARET,
  CC_COLON,
  CC_DASH,
  CC_DOLLAR,
  CC_DOT,
  CC_EQ,
  CC_GT,
  CC_H_LOWER,
  CC_H_UPPER,
  CC_HASH,
  CC_LBRACE,
  CC_LF,
  CC_P_LOWER,
  CC_P_UPPER,
  CC_PIPE,
  CC_PLUS,
  CC_QMARK,
  CC_RBRACE,
  CC_S_LOWER,
  CC_S_UPPER,
  CC_SLASH,
  CC_SPACE,
  CC_SQUOTE,
  CC_STAR,
  CC_T_LOWER,
  CC_T_UPPER,
  CC_TILDE,
  CC_UNDERSCORE,
  CC_W_LOWER,
  CC_W_UPPER,
} from "../constants";
import { isAlpha } from "../utils";

/** Shared result — mutated and returned. Caller must read immediately. */
const RESULT = { token: null as unknown as InlineToken, end: 0 };

/**
 * Scan an autolink `<...>` per spec §6.5.
 *
 * Tries URI autolink first (`<scheme:path>`), then email (`<local@domain>`).
 */
export function scanAutolink(src: string, pos: number, end: number): ScanResult | null {
  if (pos + 1 >= end) return null;

  const i = pos + 1;

  // Try URI autolink: scheme + `:` + non-space chars + `>`
  const schemeEnd = scanScheme(src, i, end);

  if (schemeEnd > 0 && schemeEnd < end && src.charCodeAt(schemeEnd) === CC_COLON) {
    let j = schemeEnd + 1;

    while (j < end) {
      const code = src.charCodeAt(j);
      if (code === CC_GT) {
        const uri = src.slice(i, j);
        RESULT.token = createLinkToken(uri, "", [createTextToken(uri)]);
        RESULT.end = j + 1;
        return RESULT;
      }
      if (code === CC_SPACE || code === CC_LF || code < CC_SPACE) return null;
      j++;
    }

    return null;
  }

  // Try email autolink
  const emailEnd = scanEmail(src, i, end);

  if (emailEnd > 0) {
    const email = src.slice(i, emailEnd);
    RESULT.token = createLinkToken(`mailto:${email}`, "", [createTextToken(email)]);
    RESULT.end = emailEnd + 1;
    return RESULT;
  }

  return null;
}

/**
 * Scan URI scheme: `[a-zA-Z][a-zA-Z0-9+.-]{1,31}`.
 *
 * @returns End position of scheme or -1.
 */
function scanScheme(src: string, pos: number, end: number): number {
  if (pos >= end) return -1;
  if (!isAlpha(src.charCodeAt(pos))) return -1;

  let i = pos + 1;
  const maxLen = Math.min(pos + 32, end);

  while (i < maxLen) {
    const code = src.charCodeAt(i);

    if (
      isAlpha(code) ||
      (code >= CC_0 && code <= CC_9) ||
      code === CC_PLUS ||
      code === CC_DASH ||
      code === CC_DOT
    ) {
      i++;
    } else {
      break;
    }
  }

  if (i - pos < 2) return -1;
  return i;
}

/**
 * Check if a charCode is valid in an email local-part per spec §6.5.
 *
 * Valid chars: `[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]`
 */
function isEmailLocalChar(code: number): boolean {
  if (isAlpha(code)) return true;
  if (code >= CC_0 && code <= CC_9) return true;

  return (
    code === CC_DOT ||
    code === CC_BANG ||
    code === CC_HASH ||
    code === CC_DOLLAR ||
    code === CC_AMP ||
    code === CC_SQUOTE ||
    code === CC_STAR ||
    code === CC_PLUS ||
    code === CC_SLASH ||
    code === CC_EQ ||
    code === CC_QMARK ||
    code === CC_CARET ||
    code === CC_UNDERSCORE ||
    code === CC_BACKTICK ||
    code === CC_LBRACE ||
    code === CC_PIPE ||
    code === CC_RBRACE ||
    code === CC_TILDE ||
    code === CC_DASH
  );
}

/**
 * Check if a charCode is valid in an email domain label.
 */
function isEmailDomainChar(code: number): boolean {
  return isAlpha(code) || (code >= CC_0 && code <= CC_9) || code === CC_DASH;
}

/**
 * Scan email address for autolink: `local-part@domain`.
 *
 * @returns Position of `>` after email, or -1.
 */
function scanEmail(src: string, pos: number, end: number): number {
  let i = pos;

  const localStart = i;
  while (i < end && isEmailLocalChar(src.charCodeAt(i))) i++;

  if (i === localStart || i >= end || src.charCodeAt(i) !== CC_AT) return -1;
  i++;

  const domainStart = i;
  let lastDot = -1;

  while (i < end) {
    const code = src.charCodeAt(i);

    if (isEmailDomainChar(code)) {
      i++;
    } else if (code === CC_DOT) {
      lastDot = i;
      i++;
    } else {
      break;
    }
  }

  if (i === domainStart || lastDot === -1) return -1;
  if (src.charCodeAt(i - 1) === CC_DASH) return -1;
  if (i >= end || src.charCodeAt(i) !== CC_GT) return -1;

  return i;
}

/**
 * Scan a GFM extended autolink (no angle brackets).
 *
 * Matches `http://`, `https://`, and `www.` prefixes.
 */
export function scanGfmAutolink(src: string, pos: number, end: number): ScanResult | null {
  const protoEnd = matchProtocolPrefix(src, pos, end);

  if (protoEnd > 0) {
    let i = protoEnd;
    let lastValid = i;

    while (i < end) {
      const code = src.charCodeAt(i);
      if (code === CC_SPACE || code === CC_LF || code < CC_SPACE) break;

      if (
        code === CC_QMARK ||
        code === CC_BANG ||
        code === CC_DOT ||
        code === CC_COLON ||
        code === CC_STAR ||
        code === CC_UNDERSCORE ||
        code === CC_TILDE ||
        code === CC_SQUOTE ||
        code === CC_DASH
      ) {
        i++;
        continue;
      }

      lastValid = i + 1;
      i++;
    }

    if (lastValid <= protoEnd) return null;

    const url = src.slice(pos, lastValid);
    RESULT.token = createLinkToken(url, "", [createTextToken(url)]);
    RESULT.end = lastValid;
    return RESULT;
  }

  // Check for `www.`
  if (
    pos + 4 < end &&
    (src.charCodeAt(pos) === CC_W_LOWER || src.charCodeAt(pos) === CC_W_UPPER) &&
    (src.charCodeAt(pos + 1) === CC_W_LOWER || src.charCodeAt(pos + 1) === CC_W_UPPER) &&
    (src.charCodeAt(pos + 2) === CC_W_LOWER || src.charCodeAt(pos + 2) === CC_W_UPPER) &&
    src.charCodeAt(pos + 3) === CC_DOT
  ) {
    let i = pos + 4;

    while (i < end) {
      const code = src.charCodeAt(i);
      if (code === CC_SPACE || code === CC_LF || code < CC_SPACE) break;
      i++;
    }

    if (i <= pos + 4) return null;

    const url = src.slice(pos, i);
    RESULT.token = createLinkToken(`http://${url}`, "", [createTextToken(url)]);
    RESULT.end = i;
    return RESULT;
  }

  return null;
}

/**
 * Match `http://` or `https://` protocol prefix (case-insensitive).
 *
 * @returns End position after the prefix, or -1.
 */
export function matchProtocolPrefix(src: string, pos: number, end: number): number {
  if (pos + 7 >= end) return -1;

  const h = src.charCodeAt(pos);
  if (h !== CC_H_LOWER && h !== CC_H_UPPER) return -1;

  const t1 = src.charCodeAt(pos + 1);
  if (t1 !== CC_T_LOWER && t1 !== CC_T_UPPER) return -1;

  const t2 = src.charCodeAt(pos + 2);
  if (t2 !== CC_T_LOWER && t2 !== CC_T_UPPER) return -1;

  const p = src.charCodeAt(pos + 3);
  if (p !== CC_P_LOWER && p !== CC_P_UPPER) return -1;

  let i = pos + 4;

  const s = src.charCodeAt(i);
  if (s === CC_S_LOWER || s === CC_S_UPPER) i++;

  if (i + 3 > end) return -1;
  if (src.charCodeAt(i) !== CC_COLON) return -1;
  if (src.charCodeAt(i + 1) !== CC_SLASH) return -1;
  if (src.charCodeAt(i + 2) !== CC_SLASH) return -1;

  return i + 3;
}
