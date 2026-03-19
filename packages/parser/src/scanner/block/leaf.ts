/**
 * Leaf block scanners for the flat architecture.
 *
 * Each scanner consumes an entire block in a tight loop and returns
 * a Block record. ATX headings, fenced code, indented code,
 * thematic breaks, HTML blocks, math blocks, paragraphs.
 *
 * @module scanner/block/leaf
 */

import { CC_BACKTICK, CC_DASH, CC_DOLLAR, CC_HASH, CC_STAR, CC_UNDERSCORE } from "../constants";
import { matchHtmlBlockClose, matchHtmlBlockOpen } from "./html";
import { type Block, BlockKind, createBlock } from "./types";
import { countIndent, findLineEndFast, isBlankRange, isSpaceOrTab, nextLine } from "./utils";

/** Reusable indent result. */
const IND = { indent: 0, pos: 0 };

/** Scan an ATX heading. Returns Block or null. Spec §4.2. */
export function scanAtxHeading(
  src: string,
  bs: number,
  fns: number,
  lineEnd: number,
): Block | null {
  let p = fns;
  let depth = 0;
  while (p < lineEnd && src.charCodeAt(p) === CC_HASH && depth < 6) {
    depth++;
    p++;
  }
  if (depth === 0) return null;
  if (p < lineEnd && !isSpaceOrTab(src.charCodeAt(p))) return null;
  if (p < lineEnd && isSpaceOrTab(src.charCodeAt(p))) p++;

  const contentStart = p;
  let contentEnd = lineEnd;

  // Trim trailing spaces
  while (contentEnd > contentStart && isSpaceOrTab(src.charCodeAt(contentEnd - 1))) contentEnd--;
  // Trim trailing hashes
  const trailEnd = contentEnd;
  while (contentEnd > contentStart && src.charCodeAt(contentEnd - 1) === CC_HASH) contentEnd--;
  if (
    contentEnd === contentStart ||
    (contentEnd > contentStart && isSpaceOrTab(src.charCodeAt(contentEnd - 1)))
  ) {
    while (contentEnd > contentStart && isSpaceOrTab(src.charCodeAt(contentEnd - 1))) contentEnd--;
  } else {
    contentEnd = trailEnd;
  }

  const block = createBlock(BlockKind.AtxHeading, bs);
  block.end = lineEnd;
  block.contentStart = contentStart;
  block.contentEnd = contentEnd;
  block.level = depth;
  return block;
}

/** Scan a fenced code block to completion. Returns Block or null. Spec §4.5. */
export function scanFencedCode(
  src: string,
  bs: number,
  fns: number,
  lineEnd: number,
  fenceChar: number,
): Block | null {
  let p = fns;
  let fenceLen = 0;
  while (p < lineEnd && src.charCodeAt(p) === fenceChar) {
    fenceLen++;
    p++;
  }
  if (fenceLen < 3) return null;

  // Backtick fences: info string cannot contain backticks
  if (fenceChar === CC_BACKTICK) {
    for (let j = p; j < lineEnd; j++) {
      if (src.charCodeAt(j) === CC_BACKTICK) return null;
    }
  }

  // Extract info string
  let langStart = p;
  while (langStart < lineEnd && isSpaceOrTab(src.charCodeAt(langStart))) langStart++;
  let langEnd = langStart;
  while (langEnd < lineEnd && !isSpaceOrTab(src.charCodeAt(langEnd))) langEnd++;
  let infoEnd = lineEnd;
  while (infoEnd > langStart && isSpaceOrTab(src.charCodeAt(infoEnd - 1))) infoEnd--;

  const block = createBlock(BlockKind.FencedCode, bs);
  block.fenceChar = fenceChar;
  block.fenceLength = fenceLen;
  block.fenceIndent = fns - bs;
  if (langStart < infoEnd) {
    block.info = src.slice(langStart, infoEnd);
    block.lang = langEnd > langStart ? src.slice(langStart, langEnd) : block.info;
  }

  // Scan for closing fence
  let pos = nextLine(src, lineEnd);
  const contentStart = pos;
  const len = src.length;

  while (pos < len) {
    const le = findLineEndFast(src, pos);
    countIndent(src, pos, le, IND);
    if (IND.indent < 4) {
      let cp = IND.pos;
      let cl = 0;
      while (cp < le && src.charCodeAt(cp) === fenceChar) {
        cl++;
        cp++;
      }
      if (cl >= fenceLen && isBlankRange(src, cp, le)) {
        block.contentStart = contentStart;
        block.contentEnd = pos > contentStart ? pos - 1 : contentStart;
        block.end = le;
        return block;
      }
    }
    pos = nextLine(src, le);
  }

  // Unclosed fence — content extends to EOF
  block.contentStart = contentStart;
  block.contentEnd = pos > contentStart ? pos : contentStart;
  block.end = pos;
  return block;
}

/** Scan indented code block. Returns new position. Pushes block to array. */
export function scanIndentedCode(src: string, blocks: Array<Block>, bs: number): number {
  const len = src.length;
  let pos = bs;
  let contentEnd = bs;

  while (pos < len) {
    const le = findLineEndFast(src, pos);
    countIndent(src, pos, le, IND);
    if (IND.indent >= 4) {
      contentEnd = le;
      pos = nextLine(src, le);
    } else if (isBlankRange(src, pos, le)) {
      // Blank line — tentatively continue (may be trailing)
      pos = nextLine(src, le);
    } else {
      break;
    }
  }

  const block = createBlock(BlockKind.IndentedCode, bs);
  block.end = contentEnd;
  block.contentStart = bs;
  block.contentEnd = contentEnd;
  blocks.push(block);
  return pos;
}

/** Check if a line is a thematic break. */
export function scanThematicBreak(src: string, fns: number, lineEnd: number, ch: number): boolean {
  if (ch !== CC_STAR && ch !== CC_DASH && ch !== CC_UNDERSCORE) return false;
  let count = 0;
  for (let i = fns; i < lineEnd; i++) {
    const c = src.charCodeAt(i);
    if (c === ch) count++;
    else if (!isSpaceOrTab(c)) return false;
  }
  return count >= 3;
}

/** Scan an HTML block to completion. Returns Block or null. Spec §4.6. */
export function scanHtmlBlock(
  src: string,
  bs: number,
  fns: number,
  lineEnd: number,
  inParagraph: boolean,
): Block | null {
  const htmlType = matchHtmlBlockOpen(src, fns, lineEnd, inParagraph);
  if (htmlType === 0) return null;

  const block = createBlock(BlockKind.HtmlBlock, bs);
  block.htmlBlockType = htmlType;
  block.contentStart = bs;

  const len = src.length;
  let pos = bs;

  // Types 1-5: scan for specific close condition
  // Types 6-7: close on blank line
  while (pos < len) {
    const le = findLineEndFast(src, pos);
    if (htmlType >= 1 && htmlType <= 5) {
      if (matchHtmlBlockClose(src, pos, le, htmlType)) {
        block.end = le;
        block.contentEnd = le;
        return block;
      }
    } else if (htmlType >= 6) {
      if (pos > bs && isBlankRange(src, pos, le)) {
        block.end = le;
        block.contentEnd = pos > bs ? pos - 1 : bs;
        return block;
      }
    }
    pos = nextLine(src, le);
  }

  block.end = len;
  block.contentEnd = len;
  return block;
}

/** Scan a math block. Returns Block or null. */
export function scanMathBlock(src: string, bs: number, fns: number, lineEnd: number): Block | null {
  if (fns + 1 >= lineEnd || src.charCodeAt(fns + 1) !== CC_DOLLAR) return null;

  const block = createBlock(BlockKind.MathBlock, bs);
  block.fenceChar = CC_DOLLAR;
  block.fenceLength = 2;

  let pos = nextLine(src, lineEnd);
  const contentStart = pos;
  const len = src.length;

  while (pos < len) {
    const le = findLineEndFast(src, pos);
    countIndent(src, pos, le, IND);
    if (
      IND.pos + 1 < le &&
      src.charCodeAt(IND.pos) === CC_DOLLAR &&
      src.charCodeAt(IND.pos + 1) === CC_DOLLAR
    ) {
      let cp = IND.pos + 2;
      while (cp < le && isSpaceOrTab(src.charCodeAt(cp))) cp++;
      if (cp >= le) {
        block.contentStart = contentStart;
        block.contentEnd = pos > contentStart ? pos - 1 : contentStart;
        block.end = le;
        return block;
      }
    }
    pos = nextLine(src, le);
  }

  block.contentStart = contentStart;
  block.contentEnd = pos > contentStart ? pos : contentStart;
  block.end = pos;
  return block;
}
