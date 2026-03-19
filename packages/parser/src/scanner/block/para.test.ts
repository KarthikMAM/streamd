import { describe, expect, it } from "vitest";
import { scanParagraph } from "./para";
import type { Block } from "./types";
import { BlockKind } from "./types";

describe("scanParagraph", () => {
  it("should scan a single-line paragraph", () => {
    const blocks: Array<Block> = [];
    const src = "Hello world";
    scanParagraph(src, blocks, 0, 0, src.length, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.Paragraph);
    expect(src.slice(blocks[0]!.contentStart, blocks[0]!.contentEnd)).toBe("Hello world");
  });

  it("should scan a multi-line paragraph", () => {
    const blocks: Array<Block> = [];
    const src = "Line one\nLine two\nLine three";
    scanParagraph(src, blocks, 0, 0, 8, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.Paragraph);
  });

  it("should detect setext heading with =", () => {
    const blocks: Array<Block> = [];
    const src = "Title\n=====";
    scanParagraph(src, blocks, 0, 0, 5, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.SetextHeading);
    expect(blocks[0]!.level).toBe(1);
  });

  it("should detect setext heading with -", () => {
    const blocks: Array<Block> = [];
    const src = "Title\n-----";
    scanParagraph(src, blocks, 0, 0, 5, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.SetextHeading);
    expect(blocks[0]!.level).toBe(2);
  });

  it("should detect GFM table when tables enabled", () => {
    const blocks: Array<Block> = [];
    const src = "| A | B |\n|---|---|\n| 1 | 2 |";
    scanParagraph(src, blocks, 0, 0, 9, true, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.Table);
  });

  it("should stop at blank line", () => {
    const blocks: Array<Block> = [];
    const src = "Para one\n\nPara two";
    const pos = scanParagraph(src, blocks, 0, 0, 8, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.Paragraph);
    expect(pos).toBe(9);
  });

  it("should stop at ATX heading", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n# Heading";
    const pos = scanParagraph(src, blocks, 0, 0, 9, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.Paragraph);
    expect(pos).toBe(10);
  });

  it("should stop at fenced code", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n```\ncode\n```";
    const pos = scanParagraph(src, blocks, 0, 0, 9, false, false);
    expect(blocks.length).toBe(1);
    expect(pos).toBe(10);
  });

  it("should stop at blockquote", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n> quote";
    const pos = scanParagraph(src, blocks, 0, 0, 9, false, false);
    expect(blocks.length).toBe(1);
    expect(pos).toBe(10);
  });

  it("should stop at thematic break", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n---";
    scanParagraph(src, blocks, 0, 0, 9, false, false);
    expect(blocks.length).toBe(1);
  });

  it("should stop at unordered list", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n- item";
    const pos = scanParagraph(src, blocks, 0, 0, 9, false, false);
    expect(blocks.length).toBe(1);
    expect(pos).toBe(10);
  });

  it("should let ordered list starting with non-1 interrupt paragraph", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n2. item";
    const pos = scanParagraph(src, blocks, 0, 0, 9, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.Paragraph);
    expect(pos).toBe(10);
  });

  it("should let ordered list starting with 1 interrupt paragraph", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n1. item";
    const pos = scanParagraph(src, blocks, 0, 0, 9, false, false);
    expect(blocks.length).toBe(1);
    expect(pos).toBe(10);
  });

  it("should stop at HTML block", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n<div>";
    scanParagraph(src, blocks, 0, 0, 9, false, false);
    expect(blocks.length).toBe(1);
  });

  it("should stop at math block when enabled", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n$$";
    const pos = scanParagraph(src, blocks, 0, 0, 9, false, true);
    expect(blocks.length).toBe(1);
    expect(pos).toBe(10);
  });

  it("should continue paragraph with 4+ indent (lazy content)", () => {
    const blocks: Array<Block> = [];
    const src = "Para text\n    indented content";
    scanParagraph(src, blocks, 0, 0, 9, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.contentEnd).toBe(src.length);
  });

  it("should detect setext underline after multiple paragraph lines", () => {
    const blocks: Array<Block> = [];
    const src = "Line 1\nLine 2\n======";
    scanParagraph(src, blocks, 0, 0, 6, false, false);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.SetextHeading);
    expect(blocks[0]!.level).toBe(1);
  });
});
