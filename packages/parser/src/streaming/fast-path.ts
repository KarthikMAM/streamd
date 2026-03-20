/**
 * Streaming fast-path checks — gatekeepers for O(K) optimizations.
 *
 * Each function scans only the new content (from prevLen forward) to
 * determine if the active block continues without structural change.
 * All checks are conservative: false negatives fall back to the full
 * scan path with no correctness impact.
 *
 * @module streaming/fast-path
 */

import { countIndent, findLineEndFast, isBlankRange, nextLine } from "../scanner/block/utils";
import {
  CC_0,
  CC_9,
  CC_BACKTICK,
  CC_DASH,
  CC_DOLLAR,
  CC_EQ,
  CC_GT,
  CC_HASH,
  CC_LF,
  CC_LT,
  CC_PIPE,
  CC_PLUS,
  CC_SPACE,
  CC_STAR,
  CC_TAB,
  CC_TILDE,
  CC_UNDERSCORE,
} from "../scanner/constants";
import { selectDispatch } from "../scanner/inline/dispatch";

/** Reusable indent result for continuation checks. */
const IND = { indent: 0, pos: 0 };

/**
 * Check if new lines are all paragraph continuation — no blank lines,
 * no block-start markers, no setext underlines.
 */
export function isParagraphContinuation(
  src: string,
  prevLen: number,
  lastComplete: number,
  math: boolean,
): boolean {
  let pos = findLineStart(src, prevLen);

  while (pos < lastComplete) {
    const le = findLineEndFast(src, pos);
    if (isBlankRange(src, pos, le)) return false;

    countIndent(src, pos, le, IND);
    if (IND.indent < 4) {
      const fns = IND.pos;
      if (fns < le && isBlockStartChar(src.charCodeAt(fns), math)) return false;
      if (fns < le) {
        const ch = src.charCodeAt(fns);
        if ((ch === CC_EQ || ch === CC_DASH) && isSetextLine(src, fns, le, ch)) return false;
      }
    }

    pos = nextLine(src, le);
  }

  return true;
}

/**
 * Check if new content (prevLen to srcLen) is plain text — no inline-special
 * characters that would trigger delimiter/link/entity/etc. handlers.
 *
 * When true AND the previous paragraph ended with a Text token, we can
 * extend that token's content string instead of re-parsing all inlines.
 * True O(K) for the common LLM word-append case.
 */
export function isPlainTextAppend(
  src: string,
  prevLen: number,
  srcLen: number,
  math: boolean,
  autolinks: boolean,
  strikethrough: boolean,
): boolean {
  const dispatch = selectDispatch(math, autolinks, strikethrough);
  for (let i = prevLen; i < srcLen; i++) {
    const code = src.charCodeAt(i);
    if (code < 128 && dispatch[code] !== 0) return false;
  }
  return true;
}

/**
 * Check if new lines contain a closing fence for a fenced code block.
 * Only scans lines starting from prevLen — O(K).
 */
export function hasFenceClose(
  src: string,
  prevLen: number,
  lastComplete: number,
  fenceChar: number,
  fenceLen: number,
): boolean {
  let pos = findLineStart(src, prevLen);
  while (pos < lastComplete) {
    const le = findLineEndFast(src, pos);
    countIndent(src, pos, le, IND);
    if (IND.indent < 4) {
      let cp = IND.pos;
      let cl = 0;
      while (cp < le && src.charCodeAt(cp) === fenceChar) {
        cl++;
        cp++;
      }
      if (cl >= fenceLen && isBlankRange(src, cp, le)) return true;
    }
    pos = nextLine(src, le);
  }
  return false;
}

/**
 * Check if new lines contain a closing $$ for a math block.
 * Only scans lines starting from prevLen — O(K).
 */
export function hasMathClose(src: string, prevLen: number, lastComplete: number): boolean {
  let pos = findLineStart(src, prevLen);
  while (pos < lastComplete) {
    const le = findLineEndFast(src, pos);
    countIndent(src, pos, le, IND);
    if (
      IND.pos + 1 < le &&
      src.charCodeAt(IND.pos) === CC_DOLLAR &&
      src.charCodeAt(IND.pos + 1) === CC_DOLLAR
    ) {
      let cp = IND.pos + 2;
      while (cp < le && (src.charCodeAt(cp) === CC_SPACE || src.charCodeAt(cp) === CC_TAB)) cp++;
      if (cp >= le) return true;
    }
    pos = nextLine(src, le);
  }
  return false;
}

/** Extract fenced code content, appending trailing newline if needed. */
export function extractFencedContent(
  src: string,
  contentStart: number,
  contentEnd: number,
): string {
  const content = src.slice(contentStart, contentEnd);
  if (content.length > 0 && content.charCodeAt(content.length - 1) !== CC_LF) {
    return content + "\n";
  }
  return content;
}

/** Find the start of the line containing offset. */
export function findLineStart(src: string, offset: number): number {
  if (offset <= 0) return 0;
  if (src.charCodeAt(offset - 1) === CC_LF) return offset;
  let p = offset - 1;
  while (p > 0 && src.charCodeAt(p - 1) !== CC_LF) p--;
  return p;
}

/** Check if a character could start a new block that interrupts a paragraph. */
function isBlockStartChar(ch: number, math: boolean): boolean {
  if (ch === CC_HASH) return true;
  if (ch === CC_BACKTICK || ch === CC_TILDE) return true;
  if (ch === CC_GT) return true;
  if (ch === CC_LT) return true;
  if (ch === CC_PIPE) return true;
  if (ch === CC_DASH || ch === CC_STAR || ch === CC_PLUS || ch === CC_UNDERSCORE) return true;
  if (ch >= CC_0 && ch <= CC_9) return true;
  if (math && ch === CC_DOLLAR) return true;
  return false;
}

/** Check if a line is a setext underline. */
function isSetextLine(src: string, fns: number, lineEnd: number, ch: number): boolean {
  let p = fns + 1;
  while (p < lineEnd && src.charCodeAt(p) === ch) p++;
  while (p < lineEnd) {
    const c = src.charCodeAt(p);
    if (c !== CC_SPACE && c !== CC_TAB) return false;
    p++;
  }
  return true;
}
