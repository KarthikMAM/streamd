/**
 * Unit tests for streaming fast-path checks.
 *
 * @module streaming/fast-path.test
 */
import { describe, expect, it } from "vitest";
import {
  extractFencedContent,
  findLineStart,
  hasFenceClose,
  hasMathClose,
  isParagraphContinuation,
  isPlainTextAppend,
} from "./fast-path";

describe("isParagraphContinuation", () => {
  it("should return true for plain text continuation", () => {
    const src = "Hello\nworld\n";
    expect(isParagraphContinuation(src, 6, 12, false)).toBe(true);
  });

  it("should return false when blank line appears", () => {
    const src = "Hello\n\nworld\n";
    expect(isParagraphContinuation(src, 6, 13, false)).toBe(false);
  });

  it("should return false when heading marker appears", () => {
    const src = "Hello\n# Heading\n";
    expect(isParagraphContinuation(src, 6, 16, false)).toBe(false);
  });

  it("should return false for blockquote marker", () => {
    const src = "Hello\n> quote\n";
    expect(isParagraphContinuation(src, 6, 14, false)).toBe(false);
  });

  it("should return false for setext underline", () => {
    const src = "Hello\n===\n";
    expect(isParagraphContinuation(src, 6, 10, false)).toBe(false);
  });

  it("should allow indent >= 4 as lazy continuation", () => {
    const src = "Hello\n    indented\n";
    expect(isParagraphContinuation(src, 6, 19, false)).toBe(true);
  });
});

describe("isPlainTextAppend", () => {
  it("should return true for plain words", () => {
    const src = "Hello world";
    expect(isPlainTextAppend(src, 6, 11, false, false, false)).toBe(true);
  });

  it("should return false when asterisk present", () => {
    const src = "Hello *bold*";
    expect(isPlainTextAppend(src, 6, 12, false, false, false)).toBe(false);
  });

  it("should return false when backtick present", () => {
    const src = "Hello `code`";
    expect(isPlainTextAppend(src, 6, 12, false, false, false)).toBe(false);
  });

  it("should return false when newline present", () => {
    const src = "Hello\nworld";
    expect(isPlainTextAppend(src, 5, 11, false, false, false)).toBe(false);
  });

  it("should return false for dollar when math enabled", () => {
    const src = "Hello $x$";
    expect(isPlainTextAppend(src, 6, 9, true, false, false)).toBe(false);
  });

  it("should return true for dollar when math disabled", () => {
    const src = "Hello $5";
    expect(isPlainTextAppend(src, 6, 8, false, false, false)).toBe(true);
  });
});

describe("hasFenceClose", () => {
  it("should detect backtick closing fence", () => {
    const src = "```\ncode\n```\n";
    expect(hasFenceClose(src, 9, 13, 0x60, 3)).toBe(true);
  });

  it("should not detect fence with fewer backticks", () => {
    const src = "```\ncode\n``\n";
    expect(hasFenceClose(src, 9, 12, 0x60, 3)).toBe(false);
  });

  it("should detect tilde closing fence", () => {
    const src = "~~~\ncode\n~~~\n";
    expect(hasFenceClose(src, 9, 13, 0x7e, 3)).toBe(true);
  });
});

describe("hasMathClose", () => {
  it("should detect closing $$", () => {
    const src = "$$\nx\n$$\n";
    expect(hasMathClose(src, 5, 8)).toBe(true);
  });

  it("should not detect single $", () => {
    const src = "$$\nx\n$\n";
    expect(hasMathClose(src, 5, 7)).toBe(false);
  });
});

describe("extractFencedContent", () => {
  it("should append newline if missing", () => {
    expect(extractFencedContent("abc", 0, 3)).toBe("abc\n");
  });

  it("should not double newline", () => {
    expect(extractFencedContent("abc\n", 0, 4)).toBe("abc\n");
  });

  it("should handle empty content", () => {
    expect(extractFencedContent("", 0, 0)).toBe("");
  });
});

describe("findLineStart", () => {
  it("should return 0 for offset 0", () => {
    expect(findLineStart("abc", 0)).toBe(0);
  });

  it("should return offset when preceded by LF", () => {
    expect(findLineStart("abc\ndef", 4)).toBe(4);
  });

  it("should back up to line start", () => {
    expect(findLineStart("abc\ndef", 6)).toBe(4);
  });
});
