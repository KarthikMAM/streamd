/**
 * List scanner for the flat architecture.
 *
 * Scans a list to completion — finds the extent of all list items
 * at the same level. Content is stored as a range and items are
 * parsed during assembly.
 *
 * @module scanner/block/list
 */
import { CC_0, CC_9, CC_DASH, CC_DOT, CC_PLUS, CC_RPAREN, CC_SPACE, CC_STAR } from "../constants";
import { type Block, BlockKind, createBlock } from "./types";
import { countIndent, findLineEndFast, isBlankRange, nextLine } from "./utils";

/** Reusable indent result. */
const IND = { indent: 0, pos: 0 };

/**
 * Scan a list (ordered or unordered) to completion.
 *
 * Consumes all consecutive list items of the same type, including
 * continuation lines and blank lines between items.
 */
export function scanList(src: string, bs: number, ordered: boolean, taskListItems: boolean): Block {
  const len = src.length;
  let pos = bs;
  let contentEnd = bs;
  let marker = -1;
  let startNum = 0;

  while (pos < len) {
    const le = findLineEndFast(src, pos);
    countIndent(src, pos, le, IND);
    const fns = IND.pos;

    if (fns >= le) {
      // Blank line — check if list continues after it
      pos = nextLine(src, le);

      // Skip additional blank lines
      let peekPos = pos;
      while (peekPos < len) {
        const peekLE = findLineEndFast(src, peekPos);
        if (!isBlankRange(src, peekPos, peekLE)) break;
        peekPos = nextLine(src, peekLE);
      }

      if (peekPos < len) {
        const peekLE = findLineEndFast(src, peekPos);
        countIndent(src, peekPos, peekLE, IND);
        if (isListItemStart(src, IND.pos, peekLE, ordered, marker)) {
          contentEnd = le;
          pos = peekPos;
          continue;
        }
      }

      // Not continued — break (blank lines already consumed)
      break;
    }

    if (isListItemStart(src, fns, le, ordered, marker)) {
      if (marker === -1) {
        if (ordered) {
          marker = 0;
        } else {
          marker = src.charCodeAt(fns);
        }
        startNum = ordered ? parseOrderedStart(src, fns, le) : 0;
      }
      contentEnd = le;
      pos = nextLine(src, le);
    } else if (IND.indent >= 2 && contentEnd > bs) {
      // Continuation line (indented content under a list item)
      contentEnd = le;
      pos = nextLine(src, le);
    } else {
      break;
    }
  }

  const block = createBlock(BlockKind.List, bs);
  block.end = contentEnd;
  block.contentStart = bs;
  block.contentEnd = contentEnd;
  block.ordered = ordered;
  block.listStart = startNum;
  block.taskListItems = taskListItems;
  return block;
}

/**
 * Check if position starts a list item of the given type.
 */
function isListItemStart(
  src: string,
  fns: number,
  lineEnd: number,
  ordered: boolean,
  marker: number,
): boolean {
  if (ordered) return isOrderedListItem(src, fns, lineEnd);

  const ch = src.charCodeAt(fns);
  if (!(ch === CC_DASH || ch === CC_STAR || ch === CC_PLUS)) return false;
  if (fns + 1 >= lineEnd || src.charCodeAt(fns + 1) !== CC_SPACE) return false;
  return marker === -1 || ch === marker;
}

/**
 * Check if position starts an ordered list item (digits + . or ) + space).
 */
export function isOrderedListStart(src: string, fns: number, lineEnd: number): boolean {
  return isOrderedListItem(src, fns, lineEnd);
}

/** Internal ordered list item check. Spec §5.2: max 9 digits. */
function isOrderedListItem(src: string, fns: number, lineEnd: number): boolean {
  let p = fns;
  if (p >= lineEnd) return false;
  if (src.charCodeAt(p) < CC_0 || src.charCodeAt(p) > CC_9) return false;

  const digitStart = p;
  while (p < lineEnd && src.charCodeAt(p) >= CC_0 && src.charCodeAt(p) <= CC_9) p++;

  // Spec §5.2: ordered list marker is 1-9 digits
  if (p - digitStart > 9) return false;
  if (p >= lineEnd) return false;

  const delim = src.charCodeAt(p);
  if (delim !== CC_DOT && delim !== CC_RPAREN) return false;
  return p + 1 < lineEnd && src.charCodeAt(p + 1) === CC_SPACE;
}

/** Parse the start number from an ordered list item. */
function parseOrderedStart(src: string, fns: number, lineEnd: number): number {
  let p = fns;
  let num = 0;
  while (p < lineEnd && src.charCodeAt(p) >= CC_0 && src.charCodeAt(p) <= CC_9) {
    num = num * 10 + (src.charCodeAt(p) - CC_0);
    p++;
  }
  return num;
}
