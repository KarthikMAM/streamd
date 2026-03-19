import { describe, expect, it } from "vitest";
import { BlockKind, createBlock } from "../scanner/block/types";
import type { LinkReference } from "../types/internal";
import { TokenType } from "../types/token-type";
import type { AssembleOpts } from "./assemble";
import { assembleTable } from "./table";

const DEFAULT_OPTS: AssembleOpts = {
  math: false,
  strikethrough: false,
  autolinks: false,
  tables: true,
  taskListItems: false,
};

describe("assembleTable", () => {
  it("should assemble a simple table", () => {
    const src = "| A | B |\n|---|---|\n| 1 | 2 |";
    const block = createBlock(BlockKind.Table, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    block.align = [null, null];
    const refMap = new Map<string, LinkReference>();
    const token = assembleTable(src, block, refMap, DEFAULT_OPTS);
    expect(token.type).toBe(TokenType.Table);
    if (token.type === TokenType.Table) {
      expect(token.head.length).toBe(2);
      expect(token.rows.length).toBe(1);
    }
  });

  it("should respect alignment", () => {
    const src = "| L | C | R |\n|:--|:--:|--:|\n| a | b | c |";
    const block = createBlock(BlockKind.Table, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    block.align = ["left", "center", "right"];
    const refMap = new Map<string, LinkReference>();
    const token = assembleTable(src, block, refMap, DEFAULT_OPTS);
    if (token.type === TokenType.Table) {
      expect(token.align).toEqual(["left", "center", "right"]);
    }
  });

  it("should handle multiple data rows", () => {
    const src = "| A |\n|---|\n| 1 |\n| 2 |\n| 3 |";
    const block = createBlock(BlockKind.Table, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    block.align = [null];
    const refMap = new Map<string, LinkReference>();
    const token = assembleTable(src, block, refMap, DEFAULT_OPTS);
    if (token.type === TokenType.Table) {
      expect(token.rows.length).toBe(3);
    }
  });

  it("should handle empty block", () => {
    const block = createBlock(BlockKind.Table, 0);
    block.end = 0;
    block.contentStart = 0;
    block.contentEnd = 0;
    block.align = [null];
    const refMap = new Map<string, LinkReference>();
    const token = assembleTable("", block, refMap, DEFAULT_OPTS);
    if (token.type === TokenType.Table) {
      expect(token.head).toEqual([]);
      expect(token.rows).toEqual([]);
    }
  });

  it("should parse inline content in cells", () => {
    const src = "| **bold** |\n|---|\n| *em* |";
    const block = createBlock(BlockKind.Table, 0);
    block.end = src.length;
    block.contentStart = 0;
    block.contentEnd = src.length;
    block.align = [null];
    const refMap = new Map<string, LinkReference>();
    const token = assembleTable(src, block, refMap, DEFAULT_OPTS);
    if (token.type === TokenType.Table) {
      expect(token.head[0]!.length).toBeGreaterThan(0);
    }
  });
});
