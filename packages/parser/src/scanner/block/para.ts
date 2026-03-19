/**
 * Paragraph scanner with setext heading and table detection.
 *
 * Scans paragraph lines until a new block start is detected.
 * Checks for setext underlines (= or -) and GFM table separators
 * on the line following the first paragraph line.
 *
 * @module scanner/block/para
 */
import type { Align } from "../../types/tokens";
import {
  CC_0,
  CC_9,
  CC_BACKTICK,
  CC_COLON,
  CC_DASH,
  CC_DOLLAR,
  CC_DOT,
  CC_EQ,
  CC_GT,
  CC_HASH,
  CC_LT,
  CC_PIPE,
  CC_PLUS,
  CC_RPAREN,
  CC_SPACE,
  CC_STAR,
  CC_TILDE,
  CC_UNDERSCORE,
} from "../constants";
import { matchHtmlBlockOpen } from "./html";
import { tryTableSeparator } from "./table-separator";
import { type Block, BlockKind, createBlock } from "./types";
import { countIndent, findLineEndFast, isBlankRange, isSpaceOrTab, nextLine } from "./utils";

/** Reusable indent result. */
const IND = { indent: 0, pos: 0 };

/**
 * Scan a paragraph, detecting setext headings and tables.
 * Returns new source position. Pushes block(s) to array.
 */
export function scanParagraph(
  src: string,
  blocks: Array<Block>,
  bs: number,
  fns: number,
  firstLineEnd: number,
  tables: boolean,
  math: boolean,
): number {
  const len = src.length;
  let contentEnd = firstLineEnd;
  let pos = nextLine(src, firstLineEnd);

  // Check second line for setext underline or table separator
  if (pos < len) {
    const nextLE = findLineEndFast(src, pos);
    countIndent(src, pos, nextLE, IND);

    // Setext heading check
    const setextLevel = checkSetextUnderline(src, IND.pos, nextLE);
    if (setextLevel > 0) {
      const block = createBlock(BlockKind.SetextHeading, bs);
      block.end = nextLE;
      block.contentStart = fns;
      block.contentEnd = firstLineEnd;
      block.level = setextLevel;
      blocks.push(block);
      return nextLine(src, nextLE);
    }

    // Table separator check (first line = header, second = separator)
    if (tables && IND.pos < nextLE) {
      const fc = src.charCodeAt(IND.pos);
      if (fc === CC_PIPE || fc === CC_DASH || fc === CC_COLON) {
        const align = tryTableSeparator(src, IND.pos, nextLE);
        if (align) {
          return scanTableBody(src, blocks, bs, fns, nextLE, align);
        }
      }
    }

    // Continue paragraph with this line if it's not a new block start
    if (!(isBlankRange(src, pos, nextLE) || isNewBlockStart(src, IND, nextLE, math))) {
      contentEnd = nextLE;
      pos = nextLine(src, nextLE);
    }
  }

  // Continue scanning paragraph lines
  while (pos < len) {
    const le = findLineEndFast(src, pos);
    if (isBlankRange(src, pos, le)) break;

    countIndent(src, pos, le, IND);
    if (IND.indent >= 4) {
      // Could be lazy continuation — but in flat architecture we break
      // (indented code can't interrupt paragraph, but 4+ indent inside
      // a paragraph is just content)
      contentEnd = le;
      pos = nextLine(src, le);
      continue;
    }

    // Check for setext underline
    const setextLevel = checkSetextUnderline(src, IND.pos, le);
    if (setextLevel > 0) {
      const block = createBlock(BlockKind.SetextHeading, bs);
      block.end = le;
      block.contentStart = fns;
      block.contentEnd = contentEnd;
      block.level = setextLevel;
      blocks.push(block);
      return nextLine(src, le);
    }

    // Check for new block start that interrupts paragraph
    if (isNewBlockStart(src, IND, le, math)) break;

    contentEnd = le;
    pos = nextLine(src, le);
  }

  // Emit paragraph
  const block = createBlock(BlockKind.Paragraph, bs);
  block.end = contentEnd;
  block.contentStart = fns;
  block.contentEnd = contentEnd;
  blocks.push(block);
  return pos;
}

/**
 * After detecting a table separator, scan remaining data rows.
 * Returns new source position.
 */
function scanTableBody(
  src: string,
  blocks: Array<Block>,
  bs: number,
  headerStart: number,
  separatorEnd: number,
  align: Array<Align>,
): number {
  const len = src.length;
  let pos = nextLine(src, separatorEnd);
  let contentEnd = separatorEnd;

  while (pos < len) {
    const le = findLineEndFast(src, pos);
    if (isBlankRange(src, pos, le)) break;
    contentEnd = le;
    pos = nextLine(src, le);
  }

  const block = createBlock(BlockKind.Table, bs);
  block.end = contentEnd;
  block.contentStart = headerStart;
  block.contentEnd = contentEnd;
  block.align = align;
  blocks.push(block);
  return pos;
}

/** Check if a line is a setext heading underline (= or -). */
function checkSetextUnderline(src: string, fns: number, lineEnd: number): number {
  if (fns >= lineEnd) return 0;
  const ch = src.charCodeAt(fns);
  if (ch !== CC_EQ && ch !== CC_DASH) return 0;

  let p = fns + 1;
  while (p < lineEnd && src.charCodeAt(p) === ch) p++;

  // Skip trailing spaces
  while (p < lineEnd && isSpaceOrTab(src.charCodeAt(p))) p++;
  if (p !== lineEnd) return 0;

  return ch === CC_EQ ? 1 : 2;
}

/**
 * Check if a line starts a new block that can interrupt a paragraph.
 * Uses the pre-computed indent result.
 */
function isNewBlockStart(
  src: string,
  ind: { indent: number; pos: number },
  lineEnd: number,
  math: boolean,
): boolean {
  const fns = ind.pos;
  if (fns >= lineEnd) return false;
  if (ind.indent >= 4) return false;

  const ch = src.charCodeAt(fns);

  // ATX heading
  if (ch === CC_HASH) {
    let p = fns;
    let d = 0;
    while (p < lineEnd && src.charCodeAt(p) === CC_HASH && d < 7) {
      d++;
      p++;
    }
    if (d >= 1 && d <= 6 && (p >= lineEnd || isSpaceOrTab(src.charCodeAt(p)))) return true;
  }

  // Fenced code
  if (ch === CC_BACKTICK || ch === CC_TILDE) {
    let p = fns;
    let c = 0;
    while (p < lineEnd && src.charCodeAt(p) === ch) {
      c++;
      p++;
    }
    if (c >= 3) return true;
  }

  // Math block
  if (math && ch === CC_DOLLAR && fns + 1 < lineEnd && src.charCodeAt(fns + 1) === CC_DOLLAR)
    return true;

  // Blockquote
  if (ch === CC_GT) return true;

  // Thematic break (-, *, _)
  if (ch === CC_DASH || ch === CC_STAR || ch === CC_UNDERSCORE) {
    let p = fns;
    let count = 0;
    let valid = true;
    while (p < lineEnd) {
      const x = src.charCodeAt(p);
      if (x === ch) count++;
      else if (!isSpaceOrTab(x)) {
        valid = false;
        break;
      }
      p++;
    }
    if (valid && count >= 3) return true;
  }

  // Unordered list
  if (
    (ch === CC_DASH || ch === CC_STAR || ch === CC_PLUS) &&
    fns + 1 < lineEnd &&
    src.charCodeAt(fns + 1) === CC_SPACE
  )
    return true;

  // Ordered list
  if (ch >= CC_0 && ch <= CC_9) {
    let p = fns;
    while (p < lineEnd && src.charCodeAt(p) >= CC_0 && src.charCodeAt(p) <= CC_9) p++;
    if (
      p < lineEnd &&
      (src.charCodeAt(p) === CC_DOT || src.charCodeAt(p) === CC_RPAREN) &&
      p + 1 < lineEnd &&
      src.charCodeAt(p + 1) === CC_SPACE
    )
      return true;
  }

  // HTML block
  if (ch === CC_LT) {
    if (matchHtmlBlockOpen(src, fns, lineEnd, true) > 0) return true;
  }

  return false;
}
