import { describe, expect, it } from "vitest";
import { countIndent, findLineEndFast, isBlankRange, isSpaceOrTab, nextLine } from "./utils";

describe("findLineEndFast", () => {
  it("should return position of LF", () => {
    expect(findLineEndFast("abc\ndef", 0)).toBe(3);
  });

  it("should return position of CR in CRLF", () => {
    expect(findLineEndFast("abc\r\ndef", 0)).toBe(3);
  });

  it("should return string length when no line ending", () => {
    expect(findLineEndFast("abcdef", 0)).toBe(6);
  });

  it("should respect start position", () => {
    expect(findLineEndFast("ab\ncd\nef", 3)).toBe(5);
  });

  it("should handle bare CR", () => {
    expect(findLineEndFast("abc\rdef", 0)).toBe(3);
  });

  it("should return pos for empty string", () => {
    expect(findLineEndFast("", 0)).toBe(0);
  });
});

describe("nextLine", () => {
  it("should advance past LF", () => {
    expect(nextLine("abc\ndef", 3)).toBe(4);
  });

  it("should advance past CRLF as a pair", () => {
    expect(nextLine("abc\r\ndef", 3)).toBe(5);
  });

  it("should advance past bare CR", () => {
    expect(nextLine("abc\rdef", 3)).toBe(4);
  });

  it("should return pos when at end of string", () => {
    expect(nextLine("abc", 3)).toBe(3);
  });
});

describe("countIndent", () => {
  const out = { indent: 0, pos: 0 };

  it("should count spaces as indent", () => {
    countIndent("   abc", 0, 6, out);
    expect(out.indent).toBe(3);
    expect(out.pos).toBe(3);
  });

  it("should expand tab to 4 spaces at column 0", () => {
    countIndent("\tabc", 0, 4, out);
    expect(out.indent).toBe(4);
    expect(out.pos).toBe(1);
  });

  it("should expand tab with partial column offset", () => {
    countIndent(" \tabc", 0, 5, out);
    expect(out.indent).toBe(4);
    expect(out.pos).toBe(2);
  });

  it("should handle empty range", () => {
    countIndent("abc", 3, 3, out);
    expect(out.indent).toBe(0);
    expect(out.pos).toBe(3);
  });

  it("should stop at first non-whitespace", () => {
    countIndent("abc", 0, 3, out);
    expect(out.indent).toBe(0);
    expect(out.pos).toBe(0);
  });
});

describe("isBlankRange", () => {
  it("should return true for spaces only", () => {
    expect(isBlankRange("   ", 0, 3)).toBe(true);
  });

  it("should return true for tabs only", () => {
    expect(isBlankRange("\t\t", 0, 2)).toBe(true);
  });

  it("should return true for empty range", () => {
    expect(isBlankRange("abc", 1, 1)).toBe(true);
  });

  it("should return false for non-whitespace", () => {
    expect(isBlankRange("abc", 0, 3)).toBe(false);
  });
});

describe("isSpaceOrTab", () => {
  it("should return true for space", () => {
    expect(isSpaceOrTab(0x20)).toBe(true);
  });

  it("should return true for tab", () => {
    expect(isSpaceOrTab(0x09)).toBe(true);
  });

  it("should return false for LF", () => {
    expect(isSpaceOrTab(0x0a)).toBe(false);
  });

  it("should return false for letter", () => {
    expect(isSpaceOrTab(0x61)).toBe(false);
  });
});
