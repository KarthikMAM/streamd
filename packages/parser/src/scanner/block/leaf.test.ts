import { describe, expect, it } from "vitest";
import { CC_BACKTICK, CC_DOLLAR, CC_TILDE } from "../constants";
import {
  scanAtxHeading,
  scanFencedCode,
  scanHtmlBlock,
  scanIndentedCode,
  scanMathBlock,
  scanThematicBreak,
} from "./leaf";
import type { Block } from "./types";
import { BlockKind } from "./types";

describe("scanAtxHeading", () => {
  it("should parse # heading", () => {
    const r = scanAtxHeading("# Hello", 0, 0, 7);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe(BlockKind.AtxHeading);
    expect(r!.level).toBe(1);
  });

  it("should parse ### heading with level 3", () => {
    const r = scanAtxHeading("### Title", 0, 0, 9);
    expect(r).not.toBeNull();
    expect(r!.level).toBe(3);
  });

  it("should strip trailing hashes", () => {
    const src = "## Hello ##";
    const r = scanAtxHeading(src, 0, 0, src.length);
    expect(r).not.toBeNull();
    expect(src.slice(r!.contentStart, r!.contentEnd)).toBe("Hello");
  });

  it("should return null for ####### (7 hashes)", () => {
    expect(scanAtxHeading("####### x", 0, 0, 9)).toBeNull();
  });

  it("should return null when # not followed by space", () => {
    expect(scanAtxHeading("#notaheading", 0, 0, 12)).toBeNull();
  });
});

describe("scanFencedCode", () => {
  it("should detect backtick fence", () => {
    const src = "```js\ncode\n```";
    const r = scanFencedCode(src, 0, 0, 5, CC_BACKTICK);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe(BlockKind.FencedCode);
    expect(r!.lang).toBe("js");
  });

  it("should detect tilde fence", () => {
    const src = "~~~\ncode\n~~~";
    const r = scanFencedCode(src, 0, 0, 3, CC_TILDE);
    expect(r).not.toBeNull();
    expect(r!.fenceChar).toBe(CC_TILDE);
  });

  it("should return null for fewer than 3 fence chars", () => {
    expect(scanFencedCode("``code``", 0, 0, 8, CC_BACKTICK)).toBeNull();
  });

  it("should reject backtick fence with backtick in info", () => {
    expect(scanFencedCode("```a`b", 0, 0, 6, CC_BACKTICK)).toBeNull();
  });

  it("should handle unclosed fence", () => {
    const src = "```\ncode\nmore";
    const r = scanFencedCode(src, 0, 0, 3, CC_BACKTICK);
    expect(r).not.toBeNull();
    expect(r!.end).toBe(src.length);
  });
});

describe("scanIndentedCode", () => {
  it("should scan indented lines", () => {
    const blocks: Array<Block> = [];
    const src = "    code line 1\n    code line 2\nnot code";
    const pos = scanIndentedCode(src, blocks, 0);
    expect(blocks.length).toBe(1);
    expect(blocks[0].kind).toBe(BlockKind.IndentedCode);
    expect(pos).toBeGreaterThan(0);
  });
});

describe("scanThematicBreak", () => {
  it("should match ---", () => {
    expect(scanThematicBreak("---", 0, 3, 0x2d)).toBe(true);
  });

  it("should match ***", () => {
    expect(scanThematicBreak("***", 0, 3, 0x2a)).toBe(true);
  });

  it("should match ___", () => {
    expect(scanThematicBreak("___", 0, 3, 0x5f)).toBe(true);
  });

  it("should match with spaces between", () => {
    expect(scanThematicBreak("- - -", 0, 5, 0x2d)).toBe(true);
  });

  it("should reject fewer than 3 chars", () => {
    expect(scanThematicBreak("--", 0, 2, 0x2d)).toBe(false);
  });

  it("should reject mixed characters", () => {
    expect(scanThematicBreak("-*-", 0, 3, 0x2d)).toBe(false);
  });
});

describe("scanHtmlBlock", () => {
  it("should detect type 1 for <pre>", () => {
    const r = scanHtmlBlock("<pre>content</pre>", 0, 0, 18, false);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe(BlockKind.HtmlBlock);
    expect(r!.htmlBlockType).toBe(1);
  });

  it("should detect type 6 for <div>", () => {
    const r = scanHtmlBlock("<div>\ncontent\n</div>", 0, 0, 5, false);
    expect(r).not.toBeNull();
    expect(r!.htmlBlockType).toBe(6);
  });

  it("should return null for non-HTML", () => {
    expect(scanHtmlBlock("hello", 0, 0, 5, false)).toBeNull();
  });
});

describe("scanMathBlock", () => {
  it("should detect $$ opening", () => {
    const src = "$$\nx^2\n$$";
    const r = scanMathBlock(src, 0, 0, 2);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe(BlockKind.MathBlock);
    expect(r!.fenceChar).toBe(CC_DOLLAR);
  });

  it("should return null for single $", () => {
    expect(scanMathBlock("$ x", 0, 0, 3)).toBeNull();
  });
});
