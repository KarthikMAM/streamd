/**
 * Container block assembly for the flat architecture.
 *
 * Blockquotes: strip `>` prefixes, re-parse inner content.
 * Lists: parse items from content range, detect tight/loose.
 *
 * @module assembler/container
 */

import { scanBlocks } from "../scanner/block/scan";
import type { Block } from "../scanner/block/types";
import {
  countIndent,
  findLineEndFast,
  isBlankRange,
  isSpaceOrTab,
  nextLine,
} from "../scanner/block/utils";
import {
  CC_0,
  CC_9,
  CC_DASH,
  CC_DOT,
  CC_GT,
  CC_LBRACKET,
  CC_PLUS,
  CC_RBRACKET,
  CC_RPAREN,
  CC_SPACE,
  CC_STAR,
  CC_X_LOWER,
  CC_X_UPPER,
} from "../scanner/constants";
import { parseInlines } from "../scanner/inline/scan";
import type { LinkReference } from "../types/internal";
import type { Token } from "../types/tokens";
import {
  createBlockquoteToken,
  createListItemToken,
  createListToken,
  createParagraphToken,
} from "../utils/token-factory";
import type { AssembleOpts } from "./assemble";

/** Max recursive nesting depth for container blocks. */
const MAX_NESTING_DEPTH = 100;

/** Current nesting depth — incremented on entry, decremented on exit. */
let nestingDepth = 0;

/**
 * Assemble blockquote — strip `>` prefixes and re-parse inner content.
 * Enforces max nesting depth to prevent stack overflow on pathological input.
 */
export function assembleBlockquote(
  src: string,
  block: Block,
  refMap: Map<string, LinkReference>,
  opts: AssembleOpts,
  assembleBlock: (
    s: string,
    b: Block,
    r: Map<string, LinkReference>,
    o: AssembleOpts,
  ) => Token | null,
  extractRefs: (s: string, b: Array<Block>, r: Map<string, LinkReference>) => Set<number>,
): Token {
  if (nestingDepth >= MAX_NESTING_DEPTH) return createBlockquoteToken([]);

  nestingDepth++;
  const stripped = stripBlockquotePrefixes(src, block.contentStart, block.contentEnd);
  const innerBlocks = scanBlocks(stripped, opts.math, opts.tables, opts.taskListItems);
  const innerRefMap = new Map<string, LinkReference>(refMap);
  const consumed = extractRefs(stripped, innerBlocks, innerRefMap);

  const children: Array<Token> = [];
  for (let i = 0; i < innerBlocks.length; i++) {
    if (consumed.has(i)) continue;
    const t = assembleBlock(stripped, innerBlocks[i]!, innerRefMap, opts);
    if (t) children.push(t);
  }
  nestingDepth--;

  return createBlockquoteToken(children);
}

/** Strip `>` prefixes from blockquote content lines. */
function stripBlockquotePrefixes(src: string, start: number, end: number): string {
  const parts: Array<string> = [];
  let pos = start;
  let isFirst = true;

  while (pos <= end && pos < src.length) {
    const le = findLineEndFast(src, pos);
    const lineEnd = le > end ? end : le;

    if (isFirst) {
      parts.push(src.slice(pos, lineEnd));
      isFirst = false;
    } else {
      let lp = pos;
      while (lp < lineEnd && isSpaceOrTab(src.charCodeAt(lp))) lp++;
      if (lp < lineEnd && src.charCodeAt(lp) === CC_GT) {
        lp++;
        if (lp < lineEnd && src.charCodeAt(lp) === CC_SPACE) lp++;
        parts.push(src.slice(lp, lineEnd));
      } else {
        parts.push(src.slice(pos, lineEnd));
      }
    }

    pos = nextLine(src, le);
    if (le >= end) break;
  }

  return parts.join("\n");
}

/** Assemble a list — parse items from content range. */
export function assembleList(
  src: string,
  block: Block,
  refMap: Map<string, LinkReference>,
  opts: AssembleOpts,
): Token {
  const items = parseListItems(
    src,
    block.contentStart,
    block.contentEnd,
    block.ordered,
    block.taskListItems,
    refMap,
    opts,
  );
  const tight = !hasBlankLineBetweenItems(src, block.contentStart, block.contentEnd);
  return createListToken(block.ordered, block.listStart, tight, items);
}

/** Reusable indent result. */
const IND = { indent: 0, pos: 0 };

/** Parse list items from a content range. */
function parseListItems(
  src: string,
  contentStart: number,
  contentEnd: number,
  ordered: boolean,
  taskListItems: boolean,
  refMap: Map<string, LinkReference>,
  opts: AssembleOpts,
): Array<ReturnType<typeof createListItemToken>> {
  const items: Array<ReturnType<typeof createListItemToken>> = [];
  let pos = contentStart;

  while (pos <= contentEnd && pos < src.length) {
    const le = findLineEndFast(src, pos);
    const lineEnd = le > contentEnd ? contentEnd : le;
    countIndent(src, pos, lineEnd, IND);

    if (isBlankRange(src, pos, lineEnd)) {
      pos = nextLine(src, le);
      continue;
    }

    const fns = IND.pos;
    const itemContentStart = findItemContentStart(src, fns, lineEnd, ordered);
    if (itemContentStart === -1) {
      pos = nextLine(src, le);
      continue;
    }

    const itemEnd = findItemEnd(src, itemContentStart, contentEnd, ordered);

    let checked: boolean | null = null;
    let inlineStart = itemContentStart;
    if (taskListItems && itemContentStart + 3 < src.length) {
      if (
        src.charCodeAt(itemContentStart) === CC_LBRACKET &&
        src.charCodeAt(itemContentStart + 2) === CC_RBRACKET &&
        itemContentStart + 3 < src.length &&
        src.charCodeAt(itemContentStart + 3) === CC_SPACE
      ) {
        const inner = src.charCodeAt(itemContentStart + 1);
        if (inner === CC_SPACE) {
          checked = false;
          inlineStart = itemContentStart + 4;
        } else if (inner === CC_X_LOWER || inner === CC_X_UPPER) {
          checked = true;
          inlineStart = itemContentStart + 4;
        }
      }
    }

    const inlines = parseInlines(
      src,
      inlineStart,
      itemEnd,
      refMap,
      opts.math,
      opts.autolinks,
      opts.strikethrough,
    );
    items.push(createListItemToken(checked, [createParagraphToken(inlines)]));
    pos = itemEnd < contentEnd ? nextLine(src, itemEnd) : contentEnd + 1;
  }

  return items;
}

/** Find the start of list item content (past marker + space). */
function findItemContentStart(src: string, fns: number, lineEnd: number, ordered: boolean): number {
  let p = fns;
  if (ordered) {
    while (p < lineEnd && src.charCodeAt(p) >= CC_0 && src.charCodeAt(p) <= CC_9) p++;
    if (p >= lineEnd) return -1;
    const d = src.charCodeAt(p);
    if (d !== CC_DOT && d !== CC_RPAREN) return -1;
    p++;
  } else {
    const ch = src.charCodeAt(p);
    if (ch !== CC_DASH && ch !== CC_STAR && ch !== CC_PLUS) return -1;
    p++;
  }
  if (p < lineEnd && src.charCodeAt(p) === CC_SPACE) p++;
  return p;
}

/** Find the end of a list item (next item start or content end). */
function findItemEnd(
  src: string,
  contentStart: number,
  contentEnd: number,
  ordered: boolean,
): number {
  let pos = contentStart;
  const le = findLineEndFast(src, pos);
  pos = nextLine(src, le > contentEnd ? contentEnd : le);

  while (pos <= contentEnd && pos < src.length) {
    const lineLE = findLineEndFast(src, pos);
    const lineEnd = lineLE > contentEnd ? contentEnd : lineLE;
    countIndent(src, pos, lineEnd, IND);

    if (isBlankRange(src, pos, lineEnd)) {
      pos = nextLine(src, lineLE);
      continue;
    }

    const fns = IND.pos;
    if (IND.indent < 2) {
      const ch = src.charCodeAt(fns);
      if (
        !ordered &&
        (ch === CC_DASH || ch === CC_STAR || ch === CC_PLUS) &&
        fns + 1 < src.length &&
        src.charCodeAt(fns + 1) === CC_SPACE
      ) {
        return pos > contentStart ? findLineEndFast(src, pos - 2) : contentStart;
      }
      if (ordered && ch >= CC_0 && ch <= CC_9) {
        let pp = fns;
        while (pp < lineEnd && src.charCodeAt(pp) >= CC_0 && src.charCodeAt(pp) <= CC_9) pp++;
        if (
          pp < lineEnd &&
          (src.charCodeAt(pp) === CC_DOT || src.charCodeAt(pp) === CC_RPAREN) &&
          pp + 1 < lineEnd &&
          src.charCodeAt(pp + 1) === CC_SPACE
        ) {
          return pos > contentStart ? findLineEndFast(src, pos - 2) : contentStart;
        }
      }
    }
    pos = nextLine(src, lineLE);
  }
  return contentEnd;
}

/** Check if there's a blank line between list items. */
function hasBlankLineBetweenItems(src: string, start: number, end: number): boolean {
  let pos = start;
  let inItem = false;

  while (pos <= end && pos < src.length) {
    const le = findLineEndFast(src, pos);
    const lineEnd = le > end ? end : le;
    if (isBlankRange(src, pos, lineEnd)) {
      if (inItem) return true;
    } else {
      inItem = true;
    }
    pos = nextLine(src, le);
    if (le >= end) break;
  }
  return false;
}
