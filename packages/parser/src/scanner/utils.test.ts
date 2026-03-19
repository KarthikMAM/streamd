import { describe, expect, it } from "vitest";
import { CC_LF, CC_SPACE, CC_TAB } from "./constants";
import {
  isAlpha,
  isAsciiWhitespace,
  isPunctuation,
  isUnicodeWhitespace,
  skipSpaces,
} from "./utils";

describe("isAsciiWhitespace", () => {
  it("should return true for space", () => {
    expect(isAsciiWhitespace(CC_SPACE)).toBe(true);
  });

  it("should return true for tab", () => {
    expect(isAsciiWhitespace(CC_TAB)).toBe(true);
  });

  it("should return true for LF", () => {
    expect(isAsciiWhitespace(CC_LF)).toBe(true);
  });

  it("should return false for 'a'", () => {
    expect(isAsciiWhitespace(0x61)).toBe(false);
  });
});

describe("isAlpha", () => {
  it("should return true for lowercase letter", () => {
    expect(isAlpha(0x61)).toBe(true);
  });

  it("should return true for uppercase letter", () => {
    expect(isAlpha(0x41)).toBe(true);
  });

  it("should return false for digit", () => {
    expect(isAlpha(0x30)).toBe(false);
  });

  it("should return false for space", () => {
    expect(isAlpha(CC_SPACE)).toBe(false);
  });
});

describe("isPunctuation", () => {
  it("should return true for !", () => {
    expect(isPunctuation(0x21)).toBe(true);
  });

  it("should return true for ~", () => {
    expect(isPunctuation(0x7e)).toBe(true);
  });

  it("should return false for 'a'", () => {
    expect(isPunctuation(0x61)).toBe(false);
  });

  it("should return false for non-ASCII code", () => {
    expect(isPunctuation(0x80)).toBe(false);
  });
});

describe("isUnicodeWhitespace", () => {
  it("should return true for ASCII space", () => {
    expect(isUnicodeWhitespace(CC_SPACE)).toBe(true);
  });

  it("should return true for NO-BREAK SPACE U+00A0", () => {
    expect(isUnicodeWhitespace(0x00a0)).toBe(true);
  });

  it("should return true for EM SPACE U+2003", () => {
    expect(isUnicodeWhitespace(0x2003)).toBe(true);
  });

  it("should return true for IDEOGRAPHIC SPACE U+3000", () => {
    expect(isUnicodeWhitespace(0x3000)).toBe(true);
  });

  it("should return false for 'a'", () => {
    expect(isUnicodeWhitespace(0x61)).toBe(false);
  });

  it("should return false for non-Zs non-ASCII", () => {
    expect(isUnicodeWhitespace(0x0100)).toBe(false);
  });
});

describe("skipSpaces", () => {
  it("should skip spaces", () => {
    expect(skipSpaces("   abc", 0, 6)).toBe(3);
  });

  it("should skip tabs", () => {
    expect(skipSpaces("\t\tabc", 0, 5)).toBe(2);
  });

  it("should skip mixed spaces and tabs", () => {
    expect(skipSpaces(" \t abc", 0, 6)).toBe(3);
  });

  it("should return pos when no spaces", () => {
    expect(skipSpaces("abc", 0, 3)).toBe(0);
  });

  it("should respect max boundary", () => {
    expect(skipSpaces("   abc", 0, 2)).toBe(2);
  });
});
