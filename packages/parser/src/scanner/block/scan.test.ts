import { describe, expect, it } from "vitest";
import { scanBlocks } from "./scan";
import { BlockKind } from "./types";

describe("scanBlocks", () => {
  it("should scan empty input", () => {
    expect(scanBlocks("", false, false, false)).toEqual([]);
  });

  it("should scan a single paragraph", () => {
    const blocks = scanBlocks("Hello world", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.Paragraph);
  });

  it("should scan ATX heading", () => {
    const blocks = scanBlocks("# Title", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.AtxHeading);
    expect(blocks[0]!.level).toBe(1);
  });

  it("should scan fenced code block", () => {
    const blocks = scanBlocks("```js\ncode\n```", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.FencedCode);
  });

  it("should scan thematic break", () => {
    const blocks = scanBlocks("---", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.ThematicBreak);
  });

  it("should scan blockquote", () => {
    const blocks = scanBlocks("> Quote", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.Blockquote);
  });

  it("should scan unordered list", () => {
    const blocks = scanBlocks("- Item 1\n- Item 2", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.List);
    expect(blocks[0]!.ordered).toBe(false);
  });

  it("should scan ordered list", () => {
    const blocks = scanBlocks("1. First\n2. Second", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.List);
    expect(blocks[0]!.ordered).toBe(true);
  });

  it("should scan indented code", () => {
    const blocks = scanBlocks("    code line", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.IndentedCode);
  });

  it("should scan HTML block", () => {
    const blocks = scanBlocks("<div>\ncontent\n</div>", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.HtmlBlock);
  });

  it("should scan math block when enabled", () => {
    const blocks = scanBlocks("$$\nx^2\n$$", true, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.MathBlock);
  });

  it("should not scan math block when disabled", () => {
    const blocks = scanBlocks("$$\nx^2\n$$", false, false, false);
    expect(blocks[0]!.kind).not.toBe(BlockKind.MathBlock);
  });

  it("should scan setext heading", () => {
    const blocks = scanBlocks("Title\n=====", false, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.SetextHeading);
    expect(blocks[0]!.level).toBe(1);
  });

  it("should scan multiple blocks separated by blank lines", () => {
    const blocks = scanBlocks("# Heading\n\nParagraph\n\n---", false, false, false);
    expect(blocks.length).toBe(3);
    expect(blocks[0]!.kind).toBe(BlockKind.AtxHeading);
    expect(blocks[1]!.kind).toBe(BlockKind.Paragraph);
    expect(blocks[2]!.kind).toBe(BlockKind.ThematicBreak);
  });

  it("should skip blank lines between blocks", () => {
    const blocks = scanBlocks("# A\n\n\n\n# B", false, false, false);
    expect(blocks.length).toBe(2);
    expect(blocks[0]!.kind).toBe(BlockKind.AtxHeading);
    expect(blocks[1]!.kind).toBe(BlockKind.AtxHeading);
  });
});
