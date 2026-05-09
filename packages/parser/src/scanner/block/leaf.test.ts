/**
 * Unit tests for `leaf.ts`.
 *
 * @module leaf.test
 */
import { describe, expect, it } from "vitest";
import { CC_BACKTICK, CC_DOLLAR, CC_TILDE } from "../constants";
import {
  scanAtxHeading,
  scanFencedCode,
  scanIndentedCode,
  scanMathBlock,
  scanThematicBreak,
} from "./leaf";
import type { Block } from "./types";
import { BlockKind } from "./types";

describe("scanAtxHeading", () => {
  it("parses # heading as level 1", () => {
    const r = scanAtxHeading("# Hello", 0, 0, 7);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe(BlockKind.AtxHeading);
    expect(r!.level).toBe(1);
  });

  it("parses ### heading as level 3", () => {
    const r = scanAtxHeading("### Title", 0, 0, 9);
    expect(r).not.toBeNull();
    expect(r!.level).toBe(3);
  });

  it("strips trailing hashes from content", () => {
    const src = "## Hello ##";
    const r = scanAtxHeading(src, 0, 0, src.length);
    expect(r).not.toBeNull();
    expect(src.slice(r!.contentStart, r!.contentEnd)).toBe("Hello");
  });

  it("returns null for 7 hashes (exceeds max level)", () => {
    expect(scanAtxHeading("####### x", 0, 0, 9)).toBeNull();
  });

  it("returns null when # not followed by space", () => {
    expect(scanAtxHeading("#notaheading", 0, 0, 12)).toBeNull();
  });
});

describe("scanFencedCode", () => {
  it("detects backtick fence with language", () => {
    const src = "```js\ncode\n```";
    const r = scanFencedCode(src, 0, 0, 5, CC_BACKTICK);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe(BlockKind.FencedCode);
    expect(r!.lang).toBe("js");
  });

  it("detects tilde fence", () => {
    const src = "~~~\ncode\n~~~";
    const r = scanFencedCode(src, 0, 0, 3, CC_TILDE);
    expect(r).not.toBeNull();
    expect(r!.fenceChar).toBe(CC_TILDE);
  });

  it("returns null for fewer than 3 fence chars", () => {
    expect(scanFencedCode("``code``", 0, 0, 8, CC_BACKTICK)).toBeNull();
  });

  it("rejects backtick fence with backtick in info string", () => {
    expect(scanFencedCode("```a`b", 0, 0, 6, CC_BACKTICK)).toBeNull();
  });

  it("handles unclosed fence extending to EOF", () => {
    const src = "```\ncode\nmore";
    const r = scanFencedCode(src, 0, 0, 3, CC_BACKTICK);
    expect(r).not.toBeNull();
    expect(r!.end).toBe(src.length);
  });
});

describe("scanIndentedCode", () => {
  it("scans consecutive indented lines as one block", () => {
    const blocks: Array<Block> = [];
    const src = "    code line 1\n    code line 2\nnot code";
    const pos = scanIndentedCode(src, blocks, 0);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.kind).toBe(BlockKind.IndentedCode);
    expect(pos).toBe("    code line 1\n    code line 2\n".length);
  });
});

describe("scanThematicBreak", () => {
  it("matches --- as thematic break", () => {
    expect(scanThematicBreak("---", 0, 3, 0x2d)).toBe(true);
  });

  it("matches *** as thematic break", () => {
    expect(scanThematicBreak("***", 0, 3, 0x2a)).toBe(true);
  });

  it("matches ___ as thematic break", () => {
    expect(scanThematicBreak("___", 0, 3, 0x5f)).toBe(true);
  });

  it("matches with spaces between chars", () => {
    expect(scanThematicBreak("- - -", 0, 5, 0x2d)).toBe(true);
  });

  it("rejects fewer than 3 chars", () => {
    expect(scanThematicBreak("--", 0, 2, 0x2d)).toBe(false);
  });

  it("rejects mixed characters", () => {
    expect(scanThematicBreak("-*-", 0, 3, 0x2d)).toBe(false);
  });
});

describe("scanMathBlock", () => {
  it("detects $$ opening for math block", () => {
    const src = "$$\nx^2\n$$";
    const r = scanMathBlock(src, 0, 0, 2);
    expect(r).not.toBeNull();
    expect(r!.kind).toBe(BlockKind.MathBlock);
    expect(r!.fenceChar).toBe(CC_DOLLAR);
  });

  it("returns null for single $ (not a math block)", () => {
    expect(scanMathBlock("$ x", 0, 0, 3)).toBeNull();
  });
});
