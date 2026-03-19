/**
 * Assembler — converts Block array into the public token tree.
 *
 * Leaf blocks assembled here. Container blocks (blockquotes, lists)
 * and tables delegated to split modules.
 *
 * @module assembler/assemble
 */
import { scanLinkRefDef } from "../resolver/references";
import type { Block } from "../scanner/block/types";
import { BlockKind } from "../scanner/block/types";
import { findLineEndFast, isBlankRange, nextLine } from "../scanner/block/utils";
import { CC_LF, CC_SPACE, CC_TAB } from "../scanner/constants";
import { parseInlines } from "../scanner/inline/scan";
import type { LinkReference } from "../types/internal";
import type { Token, TokensList } from "../types/tokens";

import {
  createCodeBlockToken,
  createHeadingToken,
  createHrToken,
  createHtmlBlockToken,
  createMathBlockToken,
  createParagraphToken,
  createSpaceToken,
} from "../utils/token-factory";
import { assembleBlockquote, assembleList } from "./container";
import { assembleTable } from "./table";

/** Options threaded through assembly for inline parsing. */
export interface AssembleOpts {
  math: boolean;
  strikethrough: boolean;
  autolinks: boolean;
  tables: boolean;
  taskListItems: boolean;
}

/**
 * Assemble a flat block array into the public token tree.
 */
export function assemble(src: string, blocks: Array<Block>, opts: AssembleOpts): TokensList {
  const refMap = new Map<string, LinkReference>();
  const consumed = extractAllLinkRefDefs(src, blocks, refMap);

  const tokens: TokensList = [];
  for (let i = 0; i < blocks.length; i++) {
    if (consumed.has(i)) continue;
    const token = assembleBlock(src, blocks[i]!, refMap, opts);
    if (token) tokens.push(token);
  }
  return tokens;
}

/**
 * Extract link reference definitions from all paragraph blocks.
 *
 * Returns a Set of block indices that were fully consumed (entire paragraph
 * was link ref defs). Partially consumed paragraphs have contentStart adjusted.
 * Does NOT mutate block.kind — the consumed set is tracked externally.
 */
export function extractAllLinkRefDefs(
  src: string,
  blocks: Array<Block>,
  refMap: Map<string, LinkReference>,
): Set<number> {
  const consumed = new Set<number>();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (block.kind !== BlockKind.Paragraph) continue;

    const content = src.slice(block.contentStart, block.contentEnd);
    let pos = 0;
    while (pos < content.length) {
      const result = scanLinkRefDef(content, pos, content.length, refMap);
      if (!result) break;
      pos += result.consumed;
    }

    if (pos >= content.length) {
      consumed.add(i);
    } else if (pos > 0) {
      block.contentStart = block.contentStart + pos;
    }
  }

  return consumed;
}

/** Assemble a single Block into a Token. */
export function assembleBlock(
  src: string,
  block: Block,
  refMap: Map<string, LinkReference>,
  opts: AssembleOpts,
): Token | null {
  switch (block.kind) {
    case BlockKind.Space:
      return createSpaceToken();

    case BlockKind.ThematicBreak:
      return createHrToken();

    case BlockKind.AtxHeading:
    case BlockKind.SetextHeading: {
      const inlines = parseInlines(
        src,
        block.contentStart,
        block.contentEnd,
        refMap,
        opts.math,
        opts.autolinks,
        opts.strikethrough,
      );
      return createHeadingToken(block.level as 1 | 2 | 3 | 4 | 5 | 6, inlines);
    }

    case BlockKind.Paragraph: {
      const inlines = parseInlines(
        src,
        block.contentStart,
        block.contentEnd,
        refMap,
        opts.math,
        opts.autolinks,
        opts.strikethrough,
      );
      return createParagraphToken(inlines);
    }

    case BlockKind.FencedCode:
      return assembleFencedCode(src, block);

    case BlockKind.IndentedCode:
      return assembleIndentedCode(src, block);

    case BlockKind.HtmlBlock: {
      const content = src.slice(block.contentStart, block.contentEnd);
      return createHtmlBlockToken(content.length > 0 ? `${content}\n` : "");
    }

    case BlockKind.MathBlock:
      return createMathBlockToken(src.slice(block.contentStart, block.contentEnd));

    case BlockKind.Blockquote:
      return assembleBlockquote(src, block, refMap, opts, assembleBlock, extractAllLinkRefDefs);

    case BlockKind.List:
      return assembleList(src, block, refMap, opts);

    case BlockKind.Table:
      return assembleTable(src, block, refMap, opts);

    default:
      return null;
  }
}

/** Assemble fenced code block. Spec §4.5. */
function assembleFencedCode(src: string, block: Block): Token {
  let content = src.slice(block.contentStart, block.contentEnd);

  if (block.fenceIndent > 0) {
    const lines: Array<string> = [];
    let pos = 0;
    while (pos <= content.length) {
      const nlIdx = content.indexOf("\n", pos);
      const lineEnd = nlIdx === -1 ? content.length : nlIdx;
      const line = content.slice(pos, lineEnd);
      let stripped = 0;
      let j = 0;
      while (j < line.length && stripped < block.fenceIndent) {
        const c = line.charCodeAt(j);
        if (c === CC_SPACE) {
          stripped++;
          j++;
        } else if (c === CC_TAB) {
          stripped += 4;
          j++;
        } else break;
      }
      lines.push(line.slice(j));
      pos = nlIdx === -1 ? content.length + 1 : nlIdx + 1;
    }
    content = lines.join("\n");
  }

  if (content.length > 0 && content.charCodeAt(content.length - 1) !== CC_LF) {
    content += "\n";
  }

  return createCodeBlockToken(block.lang, block.info, content);
}

/** Assemble indented code block. */
function assembleIndentedCode(src: string, block: Block): Token {
  const lines: Array<string> = [];
  let pos = block.contentStart;
  const end = block.contentEnd;

  while (pos < src.length && pos <= end) {
    const le = findLineEndFast(src, pos);
    const lineEnd = le > end ? end : le;
    const line = src.slice(pos, lineEnd);

    let stripped = 0;
    let j = 0;
    while (j < line.length && stripped < 4) {
      const c = line.charCodeAt(j);
      if (c === CC_SPACE) {
        stripped++;
        j++;
      } else if (c === CC_TAB) {
        stripped += 4;
        j++;
      } else break;
    }
    lines.push(line.slice(j));

    const np = nextLine(src, le);
    if (np <= pos) break;
    pos = np;
  }

  while (lines.length > 0) {
    const last = lines[lines.length - 1]!;
    if (isBlankRange(last, 0, last.length)) lines.pop();
    else break;
  }

  let content = lines.join("\n");
  if (content.length > 0) content += "\n";

  return createCodeBlockToken("", "", content);
}
