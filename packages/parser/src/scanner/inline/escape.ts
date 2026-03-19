/**
 * Backslash escape scanner — spec §2.4 and §6.7.
 *
 * Handles `\` + ASCII punctuation → EscapeToken, and `\` before
 * newline → HardbreakToken. Zero regex.
 *
 * @module scanner/inline/escape
 */

import type { ScanResult } from "../../types/internal";
import type { InlineToken } from "../../types/tokens";
import { createEscapeToken, createHardbreakToken } from "../../utils/token-factory";
import { CC_CR, CC_LF, CF_PUNCTUATION, CHAR_TABLE } from "../constants";

/** Shared result — mutated and returned. Caller must read immediately. */
const RESULT = { token: null as unknown as InlineToken, end: 0 };

/**
 * Scan a backslash escape or hard line break.
 * - \\ + ASCII punctuation → EscapeToken
 * - \\ before newline → HardbreakToken
 * Returns shared result or null. Caller must read immediately.
 */
export function scanEscape(src: string, pos: number, end: number): ScanResult | null {
  const next = pos + 1;
  if (next >= end) return null;

  const code = src.charCodeAt(next);

  if (code === CC_LF || code === CC_CR) {
    let newEnd = next + 1;
    if (code === CC_CR && newEnd < end && src.charCodeAt(newEnd) === CC_LF) {
      newEnd++;
    }
    RESULT.token = createHardbreakToken();
    RESULT.end = newEnd;
    return RESULT;
  }

  if (code < 128 && (CHAR_TABLE[code] & CF_PUNCTUATION) !== 0) {
    RESULT.token = createEscapeToken(String.fromCharCode(code));
    RESULT.end = next + 1;
    return RESULT;
  }

  return null;
}
