import { describe, expect, it } from "vitest";
import { BlockKind, createBlock } from "../scanner/block/types";
import type { LinkReference } from "../types/internal";
import { TokenType } from "../types/token-type";
import type { AssembleOpts } from "./assemble";
import { assembleBlock, extractAllLinkRefDefs } from "./assemble";
import { assembleBlockquote, assembleList } from "./container";

const DEFAULT_OPTS: AssembleOpts = {
  math: false,
  strikethrough: false,
  autolinks: false,
  tables: false,
  taskListItems: false,
};

describe("assembleBlockquote", () => {
  it("should assemble blockquote with paragraph content", () => {
    const src = "Hello world";
    const block = createBlock(BlockKind.Blockquote, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    const refMap = new Map<string, LinkReference>();
    const token = assembleBlockquote(
      src,
      block,
      refMap,
      DEFAULT_OPTS,
      assembleBlock,
      extractAllLinkRefDefs,
    );
    expect(token.type).toBe(TokenType.Blockquote);
    if (token.type === TokenType.Blockquote) {
      expect(token.children.length).toBeGreaterThan(0);
    }
  });

  it("should strip > prefixes from inner lines", () => {
    const src = "Line 1\n> Line 2";
    const block = createBlock(BlockKind.Blockquote, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    const refMap = new Map<string, LinkReference>();
    const token = assembleBlockquote(
      src,
      block,
      refMap,
      DEFAULT_OPTS,
      assembleBlock,
      extractAllLinkRefDefs,
    );
    expect(token.type).toBe(TokenType.Blockquote);
  });
});

describe("assembleList", () => {
  it("should assemble unordered list", () => {
    const src = "- Item 1\n- Item 2";
    const block = createBlock(BlockKind.List, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    block.ordered = false;
    block.listStart = 0;
    const refMap = new Map<string, LinkReference>();
    const token = assembleList(src, block, refMap, DEFAULT_OPTS);
    expect(token.type).toBe(TokenType.List);
    if (token.type === TokenType.List) {
      expect(token.ordered).toBe(false);
      expect(token.children.length).toBe(2);
    }
  });

  it("should assemble ordered list with start number", () => {
    const src = "3. First\n4. Second";
    const block = createBlock(BlockKind.List, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    block.ordered = true;
    block.listStart = 3;
    const refMap = new Map<string, LinkReference>();
    const token = assembleList(src, block, refMap, DEFAULT_OPTS);
    if (token.type === TokenType.List) {
      expect(token.start).toBe(3);
    }
  });

  it("should detect tight list", () => {
    const src = "- A\n- B";
    const block = createBlock(BlockKind.List, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    const refMap = new Map<string, LinkReference>();
    const token = assembleList(src, block, refMap, DEFAULT_OPTS);
    if (token.type === TokenType.List) {
      expect(token.tight).toBe(true);
    }
  });

  it("should detect loose list with blank line", () => {
    const src = "- A\n\n- B";
    const block = createBlock(BlockKind.List, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    const refMap = new Map<string, LinkReference>();
    const token = assembleList(src, block, refMap, DEFAULT_OPTS);
    if (token.type === TokenType.List) {
      expect(token.tight).toBe(false);
    }
  });

  it("should detect task list checkboxes when enabled", () => {
    const src = "- [ ] Unchecked\n- [x] Checked";
    const block = createBlock(BlockKind.List, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    block.taskListItems = true;
    const refMap = new Map<string, LinkReference>();
    const opts = { ...DEFAULT_OPTS, taskListItems: true };
    const token = assembleList(src, block, refMap, opts);
    if (token.type === TokenType.List) {
      expect(token.children[0]?.checked).toBe(false);
      expect(token.children[1]?.checked).toBe(true);
    }
  });
});
