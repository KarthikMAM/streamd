/**
 * Entity scanner for inline content — spec §2.5.
 *
 * Named entities are emitted as raw text (e.g. `&amp;` → TextToken("&amp;")).
 * Numeric entities are decoded to their Unicode character.
 * Entity resolution for named entities is a renderer concern.
 *
 * @module scanner/inline/entity
 */

import type { ScanResult } from "../../types/internal";
import type { InlineToken } from "../../types/tokens";
import { scanNamedEntity, scanNumericEntity } from "../../utils/entities";
import { createTextToken } from "../../utils/token-factory";
import { CC_HASH } from "../constants";

/** Shared result — mutated and returned. Caller must read immediately. */
const RESULT = { token: null as unknown as InlineToken, end: 0 };

/**
 * Scan an entity reference starting at `&`.
 *
 * @returns Shared result or null. Caller must read immediately.
 */
export function scanEntity(src: string, pos: number, end: number): ScanResult | null {
  const next = pos + 1;
  if (next >= end) return null;

  if (src.charCodeAt(next) === CC_HASH) {
    const numResult = scanNumericEntity(src, next + 1, end);
    if (numResult) {
      RESULT.token = createTextToken(numResult.content);
      RESULT.end = numResult.end;
      return RESULT;
    }
    return null;
  }

  const namedResult = scanNamedEntity(src, next, end);
  if (namedResult) {
    RESULT.token = createTextToken(src.slice(pos, namedResult.end));
    RESULT.end = namedResult.end;
    return RESULT;
  }

  return null;
}
