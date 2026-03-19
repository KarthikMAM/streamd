import { describe, expect, it } from "vitest";
import { BlockKind, createBlock } from "./types";

describe("FlatKind", () => {
  it("should have dense integer values starting at 0", () => {
    expect(BlockKind.Paragraph).toBe(0);
    expect(BlockKind.AtxHeading).toBe(1);
    expect(BlockKind.SetextHeading).toBe(2);
    expect(BlockKind.FencedCode).toBe(3);
    expect(BlockKind.IndentedCode).toBe(4);
    expect(BlockKind.HtmlBlock).toBe(5);
    expect(BlockKind.ThematicBreak).toBe(6);
    expect(BlockKind.Blockquote).toBe(7);
    expect(BlockKind.List).toBe(8);
    expect(BlockKind.Table).toBe(9);
    expect(BlockKind.Space).toBe(10);
    expect(BlockKind.MathBlock).toBe(11);
  });
});

describe("createFlatBlock", () => {
  it("should initialize all fields in fixed order", () => {
    const block = createBlock(BlockKind.Paragraph, 42);
    expect(block.kind).toBe(BlockKind.Paragraph);
    expect(block.start).toBe(42);
    expect(block.end).toBe(0);
    expect(block.contentStart).toBe(0);
    expect(block.contentEnd).toBe(0);
    expect(block.level).toBe(0);
    expect(block.fenceChar).toBe(0);
    expect(block.fenceLength).toBe(0);
    expect(block.fenceIndent).toBe(0);
    expect(block.lang).toBe("");
    expect(block.info).toBe("");
    expect(block.htmlBlockType).toBe(0);
    expect(block.align).toEqual([]);
    expect(block.ordered).toBe(false);
    expect(block.listStart).toBe(0);
    expect(block.taskListItems).toBe(false);
  });

  it("should produce monomorphic shapes across different kinds", () => {
    const a = createBlock(BlockKind.Paragraph, 0);
    const b = createBlock(BlockKind.FencedCode, 10);
    expect(Object.keys(a)).toEqual(Object.keys(b));
  });
});
