/**
 * Flat block scanner — scan-to-completion architecture.
 *
 * Instead of per-line open-stack processing, each block type is consumed
 * in a tight loop from start to finish. Produces a flat array of Block
 * records. Container blocks (blockquotes, lists) store content ranges and
 * are recursively parsed during assembly.
 *
 * @module scanner/block/scan
 */
import {
  CC_0,
  CC_9,
  CC_BACKTICK,
  CC_DASH,
  CC_DOLLAR,
  CC_GT,
  CC_HASH,
  CC_LT,
  CC_PIPE,
  CC_PLUS,
  CC_SPACE,
  CC_STAR,
  CC_TILDE,
  CC_UNDERSCORE,
} from "../constants";
import { scanBlockquote } from "./container";
import {
  scanAtxHeading,
  scanFencedCode,
  scanHtmlBlock,
  scanIndentedCode,
  scanMathBlock,
  scanThematicBreak,
} from "./leaf";
import { isOrderedListStart, scanList } from "./list";
import { scanParagraph } from "./para";
import { type Block, BlockKind, createBlock } from "./types";
import { countIndent, findLineEndFast, isBlankRange, nextLine } from "./utils";

/** Reusable indent measurement result — avoids allocation per line. */
const IND = { indent: 0, pos: 0 };

/**
 * Scan source into a flat array of block records.
 *
 * Each block is consumed to completion before the next is started.
 * No open-stack, no per-line container walk.
 */
export function scanBlocks(
  src: string,
  math: boolean,
  tables: boolean,
  taskListItems: boolean,
): Array<Block> {
  const blocks: Array<Block> = [];
  const len = src.length;
  let pos = 0;

  while (pos < len) {
    // Skip blank lines (no Space token emission — blank lines are
    // only significant for list tight/loose detection, handled in assembly)
    while (pos < len) {
      const le = findLineEndFast(src, pos);
      if (!isBlankRange(src, pos, le)) break;
      pos = nextLine(src, le);
    }
    if (pos >= len) break;

    const bs = pos;
    const lineEnd = findLineEndFast(src, bs);
    countIndent(src, bs, lineEnd, IND);
    const indent = IND.indent;
    const fns = IND.pos;

    if (fns >= lineEnd) {
      pos = nextLine(src, lineEnd);
      continue;
    }

    const ch = src.charCodeAt(fns);

    // Indented code (indent >= 4)
    if (indent >= 4) {
      pos = scanIndentedCode(src, blocks, bs);
      continue;
    }

    // Math block ($$)
    if (math && ch === CC_DOLLAR) {
      const r = scanMathBlock(src, bs, fns, lineEnd);
      if (r) {
        blocks.push(r);
        pos = nextLine(src, r.end);
        continue;
      }
    }

    // ATX heading
    if (ch === CC_HASH) {
      const r = scanAtxHeading(src, bs, fns, lineEnd);
      if (r) {
        blocks.push(r);
        pos = nextLine(src, lineEnd);
        continue;
      }
    }

    // Fenced code
    if (ch === CC_BACKTICK || ch === CC_TILDE) {
      const r = scanFencedCode(src, bs, fns, lineEnd, ch);
      if (r) {
        blocks.push(r);
        pos = nextLine(src, r.end);
        continue;
      }
    }

    // Thematic break
    if (ch === CC_DASH || ch === CC_STAR || ch === CC_UNDERSCORE) {
      if (scanThematicBreak(src, fns, lineEnd, ch)) {
        const hr = createBlock(BlockKind.ThematicBreak, bs);
        hr.end = lineEnd;
        blocks.push(hr);
        pos = nextLine(src, lineEnd);
        continue;
      }
    }

    // Blockquote
    if (ch === CC_GT) {
      const r = scanBlockquote(src, bs);
      blocks.push(r);
      pos = nextLine(src, r.end);
      continue;
    }

    // Unordered list
    if (
      (ch === CC_DASH || ch === CC_STAR || ch === CC_PLUS) &&
      fns + 1 < len &&
      src.charCodeAt(fns + 1) === CC_SPACE
    ) {
      const r = scanList(src, bs, false, taskListItems);
      blocks.push(r);
      pos = nextLine(src, r.end);
      continue;
    }

    // Ordered list
    if (ch >= CC_0 && ch <= CC_9 && isOrderedListStart(src, fns, lineEnd)) {
      const r = scanList(src, bs, true, taskListItems);
      blocks.push(r);
      pos = nextLine(src, r.end);
      continue;
    }

    // Table (pipe-started)
    if (tables && ch === CC_PIPE) {
      const r = scanParagraph(src, blocks, bs, fns, lineEnd, tables, math);
      pos = r;
      continue;
    }

    // HTML block
    if (ch === CC_LT) {
      const r = scanHtmlBlock(src, bs, fns, lineEnd, false);
      if (r) {
        blocks.push(r);
        pos = nextLine(src, r.end);
        continue;
      }
    }

    // Paragraph (with setext heading and table detection)
    pos = scanParagraph(src, blocks, bs, fns, lineEnd, tables, math);
  }

  return blocks;
}
