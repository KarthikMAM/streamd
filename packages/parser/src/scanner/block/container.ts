/**
 * Blockquote scanner for the flat architecture.
 *
 * Scans a blockquote to completion — finds the extent of all `>` prefixed
 * lines (including blank continuation lines). Content is stored as a range
 * and recursively parsed during assembly.
 *
 * @module scanner/block/container
 */
import { CC_GT, CC_SPACE } from "../constants";
import { type Block, BlockKind, createBlock } from "./types";
import { countIndent, findLineEndFast, isBlankRange, nextLine } from "./utils";

/** Reusable indent result. */
const IND = { indent: 0, pos: 0 };

/**
 * Scan a blockquote to completion.
 *
 * Consumes lines starting with `>` (with optional space after).
 * Blank lines continue the blockquote if followed by another `>` line.
 * Non-blank, non-`>` lines that could be lazy continuation of a paragraph
 * are also consumed (CommonMark §5.1 lazy continuation).
 */
export function scanBlockquote(src: string, bs: number): Block {
  const len = src.length;
  let pos = bs;
  let contentEnd = bs;
  let contentStart = -1;

  while (pos < len) {
    const le = findLineEndFast(src, pos);
    countIndent(src, pos, le, IND);

    if (IND.pos < le && src.charCodeAt(IND.pos) === CC_GT) {
      let s = IND.pos + 1;
      if (s < le && src.charCodeAt(s) === CC_SPACE) s++;
      if (contentStart === -1) contentStart = s;
      contentEnd = le;
      pos = nextLine(src, le);
    } else if (isBlankRange(src, pos, le)) {
      // Blank line — check if next line continues blockquote
      pos = nextLine(src, le);
      if (pos < len) {
        const nextLE = findLineEndFast(src, pos);
        countIndent(src, pos, nextLE, IND);
        if (IND.pos < nextLE && src.charCodeAt(IND.pos) === CC_GT) {
          contentEnd = le;
          continue;
        }
      }
      // Not continued — break (blank line already consumed)
      break;
    } else {
      // Lazy continuation: non-blank, non-`>` line
      if (IND.indent >= 4) break;
      contentEnd = le;
      pos = nextLine(src, le);
    }
  }

  if (contentStart === -1) contentStart = bs;

  const block = createBlock(BlockKind.Blockquote, bs);
  block.end = contentEnd;
  block.contentStart = contentStart;
  block.contentEnd = contentEnd;
  return block;
}
