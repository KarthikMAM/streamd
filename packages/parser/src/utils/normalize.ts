/**
 * Label normalization and string unescaping — zero regex.
 *
 * Spec §4.7: link reference definition label normalization.
 *
 * @module utils/normalize
 */
import {
  CC_BACKSLASH,
  CC_CR,
  CC_LF,
  CC_SPACE,
  CC_TAB,
  CF_PUNCTUATION,
  CHAR_TABLE,
} from "../scanner/constants";

/**
 * Normalize a link label per spec §4.7:
 * "To match, they must be equal after stripping leading and trailing
 * spaces/tabs, collapsing internal whitespace to single space, and
 * performing Unicode case folding."
 */
export function normalizeLabel(label: string): string {
  const len = label.length;
  if (len === 0) return "";

  let start = 0;
  while (start < len) {
    const code = label.charCodeAt(start);
    if (code !== CC_SPACE && code !== CC_TAB && code !== CC_LF && code !== CC_CR) break;
    start++;
  }

  let end = len;
  while (end > start) {
    const code = label.charCodeAt(end - 1);
    if (code !== CC_SPACE && code !== CC_TAB && code !== CC_LF && code !== CC_CR) break;
    end--;
  }

  if (start >= end) return "";

  let result = "";
  let lastWasSpace = false;

  for (let i = start; i < end; i++) {
    const code = label.charCodeAt(i);
    if (code === CC_SPACE || code === CC_TAB || code === CC_LF || code === CC_CR) {
      if (!lastWasSpace) {
        result += " ";
        lastWasSpace = true;
      }
    } else {
      result += label[i];
      lastWasSpace = false;
    }
  }

  return result.toLowerCase();
}

/**
 * Unescape backslash escapes in a string.
 *
 * Resolves `\` + ASCII punctuation → the punctuation character.
 * Entity references are passed through as-is (resolution is a renderer concern).
 * Zero regex.
 */
export function unescapeString(src: string): string {
  let hasEscape = false;

  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === CC_BACKSLASH) {
      hasEscape = true;
      break;
    }
  }

  if (!hasEscape) return src;

  let result = "";
  let i = 0;

  while (i < src.length) {
    const code = src.charCodeAt(i);

    if (code === CC_BACKSLASH && i + 1 < src.length) {
      const next = src.charCodeAt(i + 1);
      if (next < 128 && (CHAR_TABLE[next] & CF_PUNCTUATION) !== 0) {
        result += src[i + 1];
        i += 2;
        continue;
      }
    }

    result += src[i];
    i++;
  }

  return result;
}
