/**
 * HTML block type 1–7 detection and close-condition scanning.
 *
 * Spec §4.6: HTML blocks are detected by their opening line and closed
 * per type-specific rules. All matching via charCode state machines.
 *
 * @module scanner/block/html
 */
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
  HTML_BLOCK_TAGS,
  HTML_TYPE1_TAGS,
} from "../constants";
import { isAlpha, skipSpaces } from "../utils";

/** Is char alphanumeric or dash (valid in tag names after first char). */
function isTagChar(code: number): boolean {
  return isAlpha(code) || (code >= CC_0 && code <= CC_9) || code === CC_DASH;
}

/** Shared result for scanTagName — avoids allocation per call. */
const TAG_RESULT = { name: "", end: 0 };

/**
 * Extract a tag name starting at `pos`, returning lowercase name and end offset.
 *
 * Returns shared result or null. Caller must read immediately.
 */
function scanTagName(src: string, pos: number, end: number): { name: string; end: number } | null {
  if (pos >= end || !isAlpha(src.charCodeAt(pos))) return null;

  let i = pos + 1;
  while (i < end && isTagChar(src.charCodeAt(i))) i++;

  TAG_RESULT.name = src.slice(pos, i).toLowerCase();
  TAG_RESULT.end = i;
  return TAG_RESULT;
}

/**
 * Detect HTML block type 1–7 from an opening line.
 *
 * @returns Block type (1–7) or 0 if not an HTML block.
 */
export function matchHtmlBlockOpen(
  src: string,
  pos: number,
  lineEnd: number,
  inParagraph: boolean,
): number {
  if (pos >= lineEnd || src.charCodeAt(pos) !== CC_LT) return 0;

  const next = pos + 1;
  if (next >= lineEnd) return 0;

  const ch = src.charCodeAt(next);

  // Type 2: `<!--` (comment)
  if (ch === CC_BANG) {
    if (
      next + 2 < lineEnd &&
      src.charCodeAt(next + 1) === CC_DASH &&
      src.charCodeAt(next + 2) === CC_DASH
    ) {
      return 2;
    }

    // Type 4: `<!` + ASCII letter (declaration)
    if (next + 1 < lineEnd && isAlpha(src.charCodeAt(next + 1))) return 4;

    // Type 5: `<![CDATA[`
    if (
      next + 7 < lineEnd &&
      src.charCodeAt(next + 1) === CC_LBRACKET &&
      src.charCodeAt(next + 2) === CC_C_UPPER &&
      src.charCodeAt(next + 3) === CC_D_UPPER &&
      src.charCodeAt(next + 4) === CC_A_UPPER &&
      src.charCodeAt(next + 5) === CC_T_UPPER &&
      src.charCodeAt(next + 6) === CC_A_UPPER &&
      src.charCodeAt(next + 7) === CC_LBRACKET
    ) {
      return 5;
    }

    return 0;
  }

  // Type 3: `<?` (processing instruction)
  if (ch === CC_QMARK) return 3;

  // Determine if this is an open or close tag
  let tagStart = next;
  let isCloseTag = false;

  if (ch === CC_SLASH) {
    isCloseTag = true;
    tagStart = next + 1;
  }

  const tagResult = scanTagName(src, tagStart, lineEnd);
  if (!tagResult) return 0;

  const tagName = tagResult.name;
  const afterTag = tagResult.end;

  // Type 1 open: `<pre`, `<script`, `<style`, `<textarea`
  if (!isCloseTag && HTML_TYPE1_TAGS.has(tagName)) {
    if (afterTag >= lineEnd) return 1;
    const c = src.charCodeAt(afterTag);
    if (c === CC_SPACE || c === CC_TAB || c === CC_GT || c === CC_LF) return 1;
  }

  // Type 1 close: `</pre>`, `</script>`, `</style>`, `</textarea>`
  if (isCloseTag && HTML_TYPE1_TAGS.has(tagName)) {
    if (afterTag < lineEnd && src.charCodeAt(afterTag) === CC_GT) return 1;
  }

  // Type 6: known block tag
  if (HTML_BLOCK_TAGS.has(tagName)) {
    if (isCloseTag) {
      if (afterTag >= lineEnd) return 6;
      const c = src.charCodeAt(afterTag);
      if (c === CC_GT || c === CC_SPACE || c === CC_TAB) return 6;
    } else {
      if (afterTag >= lineEnd) return 6;
      const c = src.charCodeAt(afterTag);
      if (c === CC_SPACE || c === CC_TAB || c === CC_GT || c === CC_SLASH) return 6;
    }
  }

  // Type 7: other open/close tags (cannot interrupt paragraph)
  if (!inParagraph) {
    if (isCloseTag) {
      const j = skipSpaces(src, afterTag, lineEnd);
      if (j < lineEnd && src.charCodeAt(j) === CC_GT) return 7;
    } else if (isValidOpenTag(src, afterTag, lineEnd)) return 7;
  }

  return 0;
}

/**
 * Check if a line closes an HTML block of the given type.
 *
 * Types 1–5 have specific closing sequences.
 * Types 6–7 close on blank line (handled by caller).
 */
export function matchHtmlBlockClose(
  src: string,
  pos: number,
  lineEnd: number,
  htmlBlockType: number,
): boolean {
  switch (htmlBlockType) {
    case 1:
      return scanForCloseTag(src, pos, lineEnd, HTML_TYPE1_TAGS);
    case 2:
      return scanFor3(src, pos, lineEnd, CC_DASH, CC_DASH, CC_GT);
    case 3:
      return scanFor2(src, pos, lineEnd, CC_QMARK, CC_GT);
    case 4:
      return scanForChar(src, pos, lineEnd, CC_GT);
    case 5:
      return scanFor3(src, pos, lineEnd, CC_RBRACKET, CC_RBRACKET, CC_GT);
    default:
      return false;
  }
}

/** Scan for a single character in a line. */
function scanForChar(src: string, pos: number, lineEnd: number, ch: number): boolean {
  for (let i = pos; i < lineEnd; i++) {
    if (src.charCodeAt(i) === ch) return true;
  }
  return false;
}

/** Scan for two consecutive characters — no array allocation. */
function scanFor2(src: string, pos: number, lineEnd: number, a: number, b: number): boolean {
  const limit = lineEnd - 1;
  for (let i = pos; i < limit; i++) {
    if (src.charCodeAt(i) === a && src.charCodeAt(i + 1) === b) return true;
  }
  return false;
}

/** Scan for three consecutive characters — no array allocation. */
function scanFor3(
  src: string,
  pos: number,
  lineEnd: number,
  a: number,
  b: number,
  c: number,
): boolean {
  const limit = lineEnd - 2;
  for (let i = pos; i < limit; i++) {
    if (src.charCodeAt(i) === a && src.charCodeAt(i + 1) === b && src.charCodeAt(i + 2) === c)
      return true;
  }
  return false;
}

/** Scan for a type-1 close tag (`</pre>`, `</script>`, etc.) in a line. */
function scanForCloseTag(
  src: string,
  pos: number,
  lineEnd: number,
  tags: ReadonlySet<string>,
): boolean {
  for (let i = pos; i < lineEnd; i++) {
    if (src.charCodeAt(i) !== CC_LT) continue;
    if (i + 1 >= lineEnd || src.charCodeAt(i + 1) !== CC_SLASH) continue;

    const tagResult = scanTagName(src, i + 2, lineEnd);
    if (
      tagResult &&
      tags.has(tagResult.name) &&
      tagResult.end < lineEnd &&
      src.charCodeAt(tagResult.end) === CC_GT
    ) {
      return true;
    }
  }
  return false;
}

/** Check if text after a tag name forms a valid open tag with attributes. */
function isValidOpenTag(src: string, pos: number, end: number): boolean {
  let i = pos;

  while (i < end) {
    i = skipSpaces(src, i, end);
    if (i >= end) return false;

    const code = src.charCodeAt(i);

    if (code === CC_GT) return true;

    if (code === CC_SLASH) {
      return i + 1 < end && src.charCodeAt(i + 1) === CC_GT;
    }

    // Attribute name: [a-zA-Z_:][a-zA-Z0-9_.:-]*
    if (!isAlpha(code) && code !== CC_UNDERSCORE && code !== CC_COLON) return false;
    i++;
    while (i < end && isAttrNameChar(src.charCodeAt(i))) i++;

    i = skipSpaces(src, i, end);

    // Optional `= value`
    if (i < end && src.charCodeAt(i) === CC_EQ) {
      i++;
      i = skipSpaces(src, i, end);
      if (i >= end) return false;

      const valCode = src.charCodeAt(i);

      if (valCode === CC_DQUOTE || valCode === CC_SQUOTE) {
        i++;
        while (i < end && src.charCodeAt(i) !== valCode) i++;
        if (i >= end) return false;
        i++;
      } else {
        while (i < end && !isUnquotedStop(src.charCodeAt(i))) i++;
      }
    }
  }

  return false;
}

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
