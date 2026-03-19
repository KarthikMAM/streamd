/**
 * HTML entity syntax validation — zero regex, zero entity map.
 *
 * Spec §2.5: entity and numeric character references.
 *
 * This module validates entity syntax but does NOT resolve entities.
 * Named entities are emitted as raw text (e.g. `&amp;` → TextToken("&amp;")).
 * Numeric entities are decoded to their Unicode character.
 * Entity resolution is a renderer concern, not a parser concern.
 *
 * @module utils/entities
 */
import {
  CC_0,
  CC_9,
  CC_A_LOWER,
  CC_A_UPPER,
  CC_F_LOWER,
  CC_F_UPPER,
  CC_MAX_CODEPOINT,
  CC_REPLACEMENT,
  CC_SEMI,
  CC_X_LOWER,
  CC_X_UPPER,
  CC_Z_LOWER,
  CC_Z_UPPER,
} from "../scanner/constants";

/**
 * Maximum length of any HTML5 named entity (without `&` and `;`).
 */
const MAX_ENTITY_NAME_LEN = 31;

/** Shared result for named entity scan. */
const NAMED_RESULT = { content: "", end: 0 };

/**
 * Scan a named entity starting after `&`.
 *
 * Validates the syntax (`&` + alphanumeric name + `;`) but emits the raw
 * entity text including `&` and `;` as-is. Resolution is left to the renderer.
 *
 * @returns Shared result or null. Caller must read immediately.
 */
export function scanNamedEntity(
  src: string,
  pos: number,
  end: number,
): { content: string; end: number } | null {
  if (pos >= end) return null;

  const firstChar = src.charCodeAt(pos);
  if (!isAlphaNum(firstChar)) return null;

  const maxEnd = Math.min(end, pos + MAX_ENTITY_NAME_LEN + 1);
  let i = pos + 1;

  while (i < maxEnd) {
    const code = src.charCodeAt(i);

    if (code === CC_SEMI) {
      if (i === pos) return null;

      NAMED_RESULT.content = src.slice(pos, i);
      NAMED_RESULT.end = i + 1;
      return NAMED_RESULT;
    }

    if (!isAlphaNum(code)) return null;
    i++;
  }

  return null;
}

/** Shared result for numeric entity scan. */
const NUMERIC_RESULT = { content: "", end: 0 };

/**
 * Scan a numeric entity starting after `&#`.
 *
 * Handles decimal (`&#35;`) and hex (`&#x23;`, `&#X23;`).
 * Numeric entities ARE decoded to their Unicode character since the
 * code point is unambiguous and doesn't require a lookup table.
 *
 * @returns Shared result or null. Caller must read immediately.
 */
export function scanNumericEntity(
  src: string,
  pos: number,
  end: number,
): { content: string; end: number } | null {
  if (pos >= end) return null;

  let i = pos;
  let codePoint = 0;
  let isHex = false;

  const ch = src.charCodeAt(i);
  if (ch === CC_X_LOWER || ch === CC_X_UPPER) {
    isHex = true;
    i++;
  }

  const digitStart = i;

  if (isHex) {
    while (i < end && i - digitStart < 8) {
      const code = src.charCodeAt(i);
      if (code >= CC_0 && code <= CC_9) {
        codePoint = codePoint * 16 + (code - CC_0);
      } else if (code >= CC_A_LOWER && code <= CC_F_LOWER) {
        codePoint = codePoint * 16 + (code - CC_A_LOWER + 10);
      } else if (code >= CC_A_UPPER && code <= CC_F_UPPER) {
        codePoint = codePoint * 16 + (code - CC_A_UPPER + 10);
      } else {
        break;
      }
      i++;
    }
  } else {
    while (i < end && i - digitStart < 8) {
      const code = src.charCodeAt(i);
      if (code >= CC_0 && code <= CC_9) {
        codePoint = codePoint * 10 + (code - CC_0);
      } else {
        break;
      }
      i++;
    }
  }

  if (i === digitStart) return null;
  if (i >= end || src.charCodeAt(i) !== CC_SEMI) return null;

  if (codePoint === 0) codePoint = CC_REPLACEMENT;
  if (codePoint > CC_MAX_CODEPOINT) codePoint = CC_REPLACEMENT;

  NUMERIC_RESULT.content = String.fromCodePoint(codePoint);
  NUMERIC_RESULT.end = i + 1;
  return NUMERIC_RESULT;
}

/**
 * Check if a charCode is ASCII alphanumeric (a-z, A-Z, 0-9).
 */
function isAlphaNum(code: number): boolean {
  return (
    (code >= CC_A_LOWER && code <= CC_Z_LOWER) ||
    (code >= CC_A_UPPER && code <= CC_Z_UPPER) ||
    (code >= CC_0 && code <= CC_9)
  );
}
