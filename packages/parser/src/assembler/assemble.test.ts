import { describe, expect, it } from "vitest";
import type { Block, BlockKindValue } from "../scanner/block/types";
import { BlockKind, createBlock } from "../scanner/block/types";
import type { LinkReference } from "../types/internal";
import { TokenType } from "../types/token-type";
import type { AssembleOpts } from "./assemble";
import { assemble, assembleBlock, extractAllLinkRefDefs } from "./assemble";

const DEFAULT_OPTS: AssembleOpts = {
  math: false,
  strikethrough: false,
  autolinks: false,
  tables: false,
  taskListItems: false,
};

function makeBlock(kind: number, src: string, contentStart: number, contentEnd: number): Block {
  const b = createBlock(kind as BlockKindValue, 0);
  b.end = src.length;
  b.contentStart = contentStart;
  b.contentEnd = contentEnd;
  return b;
}

describe("assemble", () => {
  it("should return empty array for empty blocks", () => {
    expect(assemble("", [], DEFAULT_OPTS)).toEqual([]);
  });

  it("should assemble a paragraph block", () => {
    const src = "Hello world";
    const block = makeBlock(BlockKind.Paragraph, src, 0, src.length);
    const tokens = assemble(src, [block], DEFAULT_OPTS);
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.Paragraph);
  });

  it("should assemble a thematic break", () => {
    const block = createBlock(BlockKind.ThematicBreak, 0);
    block.end = 3;
    const tokens = assemble("---", [block], DEFAULT_OPTS);
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.Hr);
  });

  it("should skip consumed blocks via returned set", () => {
    const src = "[foo]: /url\n";
    const block = makeBlock(BlockKind.Paragraph, src, 0, src.length - 1);
    const blocks: Array<Block> = [block];
    const refMap = new Map<string, LinkReference>();
    const consumed = extractAllLinkRefDefs(src, blocks, refMap);
    expect(consumed.has(0)).toBe(true);
    // Block kind is NOT mutated
    expect(block.kind).toBe(BlockKind.Paragraph);
  });
});

describe("extractAllLinkRefDefs", () => {
  it("should extract link ref def from paragraph", () => {
    const src = "[foo]: /url\n";
    const block = makeBlock(BlockKind.Paragraph, src, 0, src.length - 1);
    const blocks: Array<Block> = [block];
    const refMap = new Map<string, LinkReference>();
    const consumed = extractAllLinkRefDefs(src, blocks, refMap);
    expect(refMap.has("foo")).toBe(true);
    expect(refMap.get("foo")?.destination).toBe("/url");
    expect(consumed.has(0)).toBe(true);
    // Block kind is NOT mutated
    expect(block.kind).toBe(BlockKind.Paragraph);
  });

  it("should not modify non-paragraph blocks", () => {
    const block = createBlock(BlockKind.ThematicBreak, 0);
    block.end = 3;
    const blocks: Array<Block> = [block];
    const refMap = new Map<string, LinkReference>();
    const consumed = extractAllLinkRefDefs("---", blocks, refMap);
    expect(refMap.size).toBe(0);
    expect(consumed.size).toBe(0);
  });

  it("should adjust contentStart for partial consumption", () => {
    const src = "[foo]: /url\nRemaining text";
    const block = makeBlock(BlockKind.Paragraph, src, 0, src.length);
    const blocks: Array<Block> = [block];
    const refMap = new Map<string, LinkReference>();
    const consumed = extractAllLinkRefDefs(src, blocks, refMap);
    expect(refMap.has("foo")).toBe(true);
    expect(consumed.has(0)).toBe(false);
    expect(block.kind).toBe(BlockKind.Paragraph);
    expect(block.contentStart).toBeGreaterThan(0);
  });
});

describe("assembleBlock", () => {
  const refMap = new Map<string, LinkReference>();

  it("should assemble ATX heading with level", () => {
    const src = "Hello";
    const block = makeBlock(BlockKind.AtxHeading, src, 0, src.length);
    block.level = 2;
    const token = assembleBlock(src, block, refMap, DEFAULT_OPTS);
    expect(token?.type).toBe(TokenType.Heading);
    if (token?.type === TokenType.Heading) {
      expect(token.level).toBe(2);
    }
  });

  it("should assemble setext heading", () => {
    const src = "Title";
    const block = makeBlock(BlockKind.SetextHeading, src, 0, src.length);
    block.level = 1;
    const token = assembleBlock(src, block, refMap, DEFAULT_OPTS);
    expect(token?.type).toBe(TokenType.Heading);
  });

  it("should assemble fenced code with lang", () => {
    const src = "const x = 1;\n";
    const block = makeBlock(BlockKind.FencedCode, src, 0, src.length);
    block.lang = "js";
    block.info = "js";
    const token = assembleBlock(src, block, refMap, DEFAULT_OPTS);
    expect(token?.type).toBe(TokenType.CodeBlock);
    if (token?.type === TokenType.CodeBlock) {
      expect(token.lang).toBe("js");
    }
  });

  it("should assemble HTML block with trailing newline", () => {
    const src = "<div>content</div>";
    const block = makeBlock(BlockKind.HtmlBlock, src, 0, src.length);
    const token = assembleBlock(src, block, refMap, DEFAULT_OPTS);
    expect(token?.type).toBe(TokenType.HtmlBlock);
    if (token?.type === TokenType.HtmlBlock) {
      expect(token.content.endsWith("\n")).toBe(true);
    }
  });

  it("should assemble math block", () => {
    const src = "x^2 + y^2";
    const block = makeBlock(BlockKind.MathBlock, src, 0, src.length);
    const token = assembleBlock(src, block, refMap, { ...DEFAULT_OPTS, math: true });
    expect(token?.type).toBe(TokenType.MathBlock);
  });

  it("should return null for unknown block kind", () => {
    const block = createBlock(99 as BlockKindValue, 0);
    expect(assembleBlock("", block, refMap, DEFAULT_OPTS)).toBeNull();
  });
});
