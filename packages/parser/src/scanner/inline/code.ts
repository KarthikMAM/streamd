/**
 * Code span scanner — spec §6.1.
 *
 * Matches opener backtick string length to closer. Handles whitespace
 * normalization and pathological input protection (max 32 backticks).
 * Zero regex.
 *
 * @module scanner/inline/code
 */

import type { ScanResult } from "../../types/internal";
import type { InlineToken } from "../../types/tokens";
import { createCodeSpanToken } from "../../utils/token-factory";
import { CC_BACKTICK, CC_CR, CC_LF, CC_SPACE } from "../constants";

/** Max backtick run length for pathological protection (md4c pattern) */
const CODESPAN_MARK_MAXLEN = 32;

/** Shared result — mutated and returned. Caller must read immediately. */
const RESULT = { token: null as unknown as InlineToken, end: 0 };

/**
 * Scan a code span starting at a backtick.
 * Spec §6.1: match opener backtick string length to closer.
 * Returns shared result or null. Caller must read immediately.
 */
export function scanCodeSpan(src: string, pos: number, end: number): ScanResult | null {
  let openerLen = 0;
  let i = pos;
  while (i < end && src.charCodeAt(i) === CC_BACKTICK && openerLen < CODESPAN_MARK_MAXLEN) {
    openerLen++;
    i++;
  }

  if (openerLen === 0) return null;

  let searchPos = i;
  while (searchPos < end) {
    while (searchPos < end && src.charCodeAt(searchPos) !== CC_BACKTICK) {
      searchPos++;
    }

    if (searchPos >= end) return null;

    let closerLen = 0;
    const closerStart = searchPos;
    while (searchPos < end && src.charCodeAt(searchPos) === CC_BACKTICK) {
      closerLen++;
      searchPos++;
    }

    if (closerLen === openerLen) {
      let content = src.slice(i, closerStart);
      content = replaceLineEndings(content);

      if (
        content.length >= 2 &&
        (content.charCodeAt(0) === CC_SPACE || content.charCodeAt(0) === CC_LF) &&
        (content.charCodeAt(content.length - 1) === CC_SPACE ||
          content.charCodeAt(content.length - 1) === CC_LF)
      ) {
        let allSpaces = true;
        for (let j = 0; j < content.length; j++) {
          if (content.charCodeAt(j) !== CC_SPACE) {
            allSpaces = false;
            break;
          }
        }
        if (!allSpaces) {
          content = content.slice(1, -1);
        }
      }

      RESULT.token = createCodeSpanToken(content);
      RESULT.end = searchPos;
      return RESULT;
    }
  }

  return null;
}

/** Replace \n and \r\n with spaces — only allocates if line endings are present */
function replaceLineEndings(s: string): string {
  // Quick scan: check if any replacement is needed
  let hasLineEnding = false;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === CC_LF || code === CC_CR) {
      hasLineEnding = true;
      break;
    }
  }
  if (!hasLineEnding) return s;

  // OPT: use slice + concat — template literals create extra intermediate strings in V8
  let result = "";
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code === CC_LF) {
      result = result + s.slice(last, i) + " ";
      last = i + 1;
    } else if (code === CC_CR) {
      result = result + s.slice(last, i) + " ";
      if (i + 1 < s.length && s.charCodeAt(i + 1) === CC_LF) i++;
      last = i + 1;
    }
  }
  return result + s.slice(last);
}
