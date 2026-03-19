/**
 * Link and image scanner — spec §6.3 (links) and §6.4 (images).
 *
 * Handles inline links `[text](dest "title")`, full reference `[text][label]`,
 * collapsed reference `[text][]`, and shortcut reference `[text]`.
 * Uses parseLinkDestination/parseLinkTitle from resolver/references.ts (DRY).
 * Zero regex.
 *
 * @module scanner/inline/link
 */

import { parseLinkDestination, parseLinkTitle } from "../../resolver/references";
import type { LinkReference, ScanResult } from "../../types/internal";
import type { InlineToken } from "../../types/tokens";
import { normalizeLabel } from "../../utils/normalize";
import { createImageToken, createLinkToken, createTextToken } from "../../utils/token-factory";
import {
  CC_BACKSLASH,
  CC_DQUOTE,
  CC_LBRACKET,
  CC_LPAREN,
  CC_RBRACKET,
  CC_RPAREN,
  CC_SQUOTE,
} from "../constants";
import { isAsciiWhitespace } from "../utils";

/** Shared result — mutated and returned. Caller must read immediately. */
const RESULT = { token: null as unknown as InlineToken, end: 0 };

/**
 * Scan a link [text](dest "title") or image ![alt](dest "title").
 * Also handles reference links [text][label], [text][], [text].
 */
export function scanLinkOrImage(
  src: string,
  pos: number,
  end: number,
  isImage: boolean,
  refMap: Map<string, LinkReference>,
): ScanResult | null {
  let i = pos;
  if (isImage) {
    if (i + 1 >= end || src.charCodeAt(i + 1) !== CC_LBRACKET) return null;
    i += 2;
  } else {
    i++;
  }

  // Find matching ]
  let depth = 1;
  const textStart = i;
  while (i < end && depth > 0) {
    const code = src.charCodeAt(i);
    if (code === CC_BACKSLASH && i + 1 < end) {
      i += 2;
      continue;
    }
    if (code === CC_LBRACKET) depth++;
    if (code === CC_RBRACKET) depth--;
    if (depth > 0) i++;
  }
  if (depth !== 0) return null;

  const textEnd = i;
  const textContent = src.slice(textStart, textEnd);
  i++;

  // (1) Try inline link: (dest "title")
  if (i < end && src.charCodeAt(i) === CC_LPAREN) {
    let j = i + 1;
    while (j < end && isAsciiWhitespace(src.charCodeAt(j))) j++;

    // Empty inline link ()
    if (j < end && src.charCodeAt(j) === CC_RPAREN) {
      RESULT.token = isImage
        ? createImageToken("", textContent, "")
        : createLinkToken("", "", [createTextToken(textContent)]);
      RESULT.end = j + 1;
      return RESULT;
    }

    const destResult = parseLinkDestination(src, j, end);
    if (destResult) {
      const dest = destResult.destination;
      j = destResult.end;
      while (j < end && isAsciiWhitespace(src.charCodeAt(j))) j++;

      let title = "";
      if (j < end) {
        const ch = src.charCodeAt(j);
        if (ch === CC_DQUOTE || ch === CC_SQUOTE || ch === CC_LPAREN) {
          const titleResult = parseLinkTitle(src, j, end);
          if (titleResult) {
            title = titleResult.title;
            j = titleResult.end;
            while (j < end && isAsciiWhitespace(src.charCodeAt(j))) j++;
          }
        }
      }

      if (j < end && src.charCodeAt(j) === CC_RPAREN) {
        j++;
        // Only allocate children array after we know the link is valid
        RESULT.token = isImage
          ? createImageToken(dest, textContent, title)
          : createLinkToken(dest, title, [createTextToken(textContent)]);
        RESULT.end = j;
        return RESULT;
      }
    }
  }

  // (2) Try full reference link: [text][label]
  if (i < end && src.charCodeAt(i) === CC_LBRACKET) {
    let j = i + 1;
    const labelStart = j;
    let d = 1;
    while (j < end && d > 0) {
      const code = src.charCodeAt(j);
      if (code === CC_BACKSLASH && j + 1 < end) {
        j += 2;
        continue;
      }
      if (code === CC_LBRACKET) d++;
      if (code === CC_RBRACKET) d--;
      if (d > 0) j++;
    }
    if (d === 0) {
      const labelText = src.slice(labelStart, j);
      j++;
      const label = normalizeLabel(labelText);
      if (label.length > 0) {
        const ref = refMap.get(label);
        if (ref) {
          RESULT.token = isImage
            ? createImageToken(ref.destination, textContent, ref.title)
            : createLinkToken(ref.destination, ref.title, [createTextToken(textContent)]);
          RESULT.end = j;
          return RESULT;
        }
      }
    }
  }

  // (3) Try collapsed reference: [text][]
  if (i + 1 < end && src.charCodeAt(i) === CC_LBRACKET && src.charCodeAt(i + 1) === CC_RBRACKET) {
    const label = normalizeLabel(textContent);
    const ref = refMap.get(label);
    if (ref) {
      RESULT.token = isImage
        ? createImageToken(ref.destination, textContent, ref.title)
        : createLinkToken(ref.destination, ref.title, [createTextToken(textContent)]);
      RESULT.end = i + 2;
      return RESULT;
    }
  }

  // (4) Try shortcut reference: [text]
  {
    const label = normalizeLabel(textContent);
    const ref = refMap.get(label);
    if (ref) {
      RESULT.token = isImage
        ? createImageToken(ref.destination, textContent, ref.title)
        : createLinkToken(ref.destination, ref.title, [createTextToken(textContent)]);
      RESULT.end = i;
      return RESULT;
    }
  }

  return null;
}
