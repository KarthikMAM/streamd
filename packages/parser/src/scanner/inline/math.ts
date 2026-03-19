/**
 * Inline math scanner — `$...$` syntax.
 *
 * Enabled when `math: true` in ParseOptions. Scans for single-dollar
 * delimited math spans (double-dollar is block math, handled separately).
 * Zero regex.
 *
 * @module scanner/inline/math
 */

import type { ScanResult } from "../../types/internal";
import type { InlineToken } from "../../types/tokens";
import { createMathInlineToken } from "../../utils/token-factory";
import { CC_BACKSLASH, CC_DOLLAR, CC_LF } from "../constants";

/** Shared result — mutated and returned. Caller must read immediately. */
const RESULT = { token: null as unknown as InlineToken, end: 0 };

/**
 * Scan an inline math span starting at $.
 * Returns shared result or null. Caller must read immediately.
 */
export function scanMathInline(src: string, pos: number, end: number): ScanResult | null {
  if (pos + 1 >= end) return null;

  // Skip $$ (block math delimiter)
  if (src.charCodeAt(pos + 1) === CC_DOLLAR) return null;

  const contentStart = pos + 1;
  let i = contentStart;

  while (i < end) {
    const code = src.charCodeAt(i);

    if (code === CC_BACKSLASH && i + 1 < end) {
      i += 2;
      continue;
    }

    if (code === CC_DOLLAR) {
      if (i + 1 < end && src.charCodeAt(i + 1) === CC_DOLLAR) {
        i += 2;
        continue;
      }
      if (i === contentStart) return null;

      RESULT.token = createMathInlineToken(src.slice(contentStart, i));
      RESULT.end = i + 1;
      return RESULT;
    }

    if (code === CC_LF) return null;
    i++;
  }

  return null;
}
