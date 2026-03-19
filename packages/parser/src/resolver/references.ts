/**
 * Link reference definition scanner and helpers.
 *
 * Spec §4.7: "A link reference definition does not correspond to a
 * structural element of the document."
 * Extracted from paragraph content during closeBlock.
 *
 * @module resolver/references
 */

import {
  CC_BACKSLASH,
  CC_COLON,
  CC_DQUOTE,
  CC_GT,
  CC_LBRACKET,
  CC_LF,
  CC_LPAREN,
  CC_LT,
  CC_RBRACKET,
  CC_RPAREN,
  CC_SPACE,
  CC_SQUOTE,
  CC_TAB,
} from "../scanner/constants";
import { skipSpaces } from "../scanner/utils";
import type { LinkReference } from "../types/internal";
import { normalizeLabel } from "../utils/normalize";

/** Shared result — avoids allocation per scan */
const REF_RESULT = { consumed: 0 };
const DEST_RESULT = { destination: "", end: 0 };
const TITLE_RESULT = { title: "", end: 0 };

/**
 * Try to extract a link reference definition from the beginning of
 * a paragraph's content lines.
 * Returns shared result or null. Caller must read immediately.
 */
export function scanLinkRefDef(
  src: string,
  start: number,
  end: number,
  refMap: Map<string, LinkReference>,
): { consumed: number } | null {
  let pos = start;

  if (pos >= end || src.charCodeAt(pos) !== CC_LBRACKET) return null;
  pos++;

  const labelStart = pos;
  let depth = 1;
  while (pos < end && depth > 0) {
    const code = src.charCodeAt(pos);
    if (code === CC_BACKSLASH && pos + 1 < end) {
      pos += 2;
      continue;
    }
    if (code === CC_LBRACKET) depth++;
    if (code === CC_RBRACKET) depth--;
    if (depth > 0) pos++;
  }
  if (depth !== 0) return null;

  const label = src.slice(labelStart, pos);
  if (label.length === 0 || label.length > 999) return null;
  pos++;

  if (pos >= end || src.charCodeAt(pos) !== CC_COLON) return null;
  pos++;

  pos = skipSpaceAndOneNewline(src, pos, end);

  const destResult = parseLinkDestination(src, pos, end);
  if (!destResult) return null;
  pos = destResult.end;

  let title = "";
  const savedPos = pos;

  pos = skipSpaces(src, pos, end);

  if (pos < end) {
    const ch = src.charCodeAt(pos);
    if (ch === CC_DQUOTE || ch === CC_SQUOTE || ch === CC_LPAREN) {
      const titleResult = parseLinkTitle(src, pos, end);
      if (titleResult) {
        title = titleResult.title;
        pos = titleResult.end;
        pos = skipSpaces(src, pos, end);
        if (pos < end && src.charCodeAt(pos) !== CC_LF) {
          title = "";
          pos = savedPos;
        }
      } else {
        pos = savedPos;
      }
    } else if (ch === CC_LF) {
      pos = savedPos;
    } else {
      return null;
    }
  }

  pos = skipSpaces(src, pos, end);
  if (pos < end && src.charCodeAt(pos) === CC_LF) pos++;

  const normalizedLabel = normalizeLabel(label);
  if (normalizedLabel.length === 0) return null;

  if (!refMap.has(normalizedLabel)) {
    refMap.set(normalizedLabel, { destination: destResult.destination, title });
  }

  REF_RESULT.consumed = pos - start;
  return REF_RESULT;
}

/**
 * Parse link destination — shared by inline-link and reference scanner.
 * Returns shared result or null. Caller must read immediately.
 */
export function parseLinkDestination(
  src: string,
  pos: number,
  end: number,
): { destination: string; end: number } | null {
  if (pos >= end) return null;

  // OPT: angle-bracket form — use slice when no escapes present — affects all
  if (src.charCodeAt(pos) === CC_LT) {
    let i = pos + 1;
    let hasEscape = false;
    while (i < end) {
      const code = src.charCodeAt(i);
      if (code === CC_GT) {
        DEST_RESULT.destination = hasEscape ? buildEscaped(src, pos + 1, i) : src.slice(pos + 1, i);
        DEST_RESULT.end = i + 1;
        return DEST_RESULT;
      }
      if (code === CC_LT || code === CC_LF) return null;
      if (code === CC_BACKSLASH && i + 1 < end) {
        hasEscape = true;
        i += 2;
        continue;
      }
      i++;
    }
    return null;
  }

  // OPT: bare URL form — use slice when no escapes present — affects all
  let i = pos;
  let parenDepth = 0;
  let hasEscape = false;
  while (i < end) {
    const code = src.charCodeAt(i);
    if (code === CC_SPACE || code === CC_TAB || code === CC_LF) break;
    if (code < CC_SPACE && code !== CC_TAB) break;
    if (code === CC_LPAREN) {
      parenDepth++;
      if (parenDepth > 32) return null;
    } else if (code === CC_RPAREN) {
      if (parenDepth === 0) break;
      parenDepth--;
    }
    if (code === CC_BACKSLASH && i + 1 < end) {
      hasEscape = true;
      i += 2;
      continue;
    }
    i++;
  }

  if (parenDepth !== 0) return null;
  if (i === pos) return null;

  DEST_RESULT.destination = hasEscape ? buildEscaped(src, pos, i) : src.slice(pos, i);
  DEST_RESULT.end = i;
  return DEST_RESULT;
}

/**
 * Parse link title — shared by inline-link and reference scanner.
 * Returns shared result or null. Caller must read immediately.
 */
export function parseLinkTitle(
  src: string,
  pos: number,
  end: number,
): { title: string; end: number } | null {
  if (pos >= end) return null;

  const opener = src.charCodeAt(pos);
  let closer: number;
  if (opener === CC_DQUOTE) closer = CC_DQUOTE;
  else if (opener === CC_SQUOTE) closer = CC_SQUOTE;
  else if (opener === CC_LPAREN) closer = CC_RPAREN;
  else return null;

  let i = pos + 1;
  let hasEscape = false;
  while (i < end) {
    const code = src.charCodeAt(i);
    if (code === closer) {
      TITLE_RESULT.title = hasEscape ? buildEscaped(src, pos + 1, i) : src.slice(pos + 1, i);
      TITLE_RESULT.end = i + 1;
      return TITLE_RESULT;
    }
    if (code === CC_BACKSLASH && i + 1 < end) {
      hasEscape = true;
      i += 2;
      continue;
    }
    i++;
  }
  return null;
}

function skipSpaceAndOneNewline(src: string, pos: number, end: number): number {
  pos = skipSpaces(src, pos, end);

  if (pos < end && src.charCodeAt(pos) === CC_LF) {
    pos++;
    pos = skipSpaces(src, pos, end);
  }

  return pos;
}

/**
 * Build a string from a range, resolving backslash escapes.
 * OPT: only called when escapes are present — common case uses src.slice() — affects all.
 */
function buildEscaped(src: string, start: number, end: number): string {
  let result = "";
  let last = start;

  for (let i = start; i < end; i++) {
    if (src.charCodeAt(i) === CC_BACKSLASH && i + 1 < end) {
      result = result + src.slice(last, i) + src[i + 1];
      i++;
      last = i + 1;
    }
  }

  return result + src.slice(last, end);
}
