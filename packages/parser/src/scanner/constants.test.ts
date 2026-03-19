import { describe, expect, it } from "vitest";
import {
  CC_AMP,
  CC_BACKSLASH,
  CC_BACKTICK,
  CC_BANG,
  CC_CR,
  CC_DOLLAR,
  CC_LBRACKET,
  CC_LF,
  CC_LT,
  CC_SPACE,
  CC_STAR,
  CC_TAB,
  CC_UNDERSCORE,
  CF_PUNCTUATION,
  CF_SPECIAL,
  CF_WHITESPACE,
  CHAR_TABLE,
} from "./constants";

describe("CHAR_TABLE", () => {
  it("should classify space as whitespace", () => {
    expect(CHAR_TABLE[CC_SPACE] & CF_WHITESPACE).not.toBe(0);
  });

  it("should classify tab as whitespace", () => {
    expect(CHAR_TABLE[CC_TAB] & CF_WHITESPACE).not.toBe(0);
  });

  it("should classify LF as whitespace", () => {
    expect(CHAR_TABLE[CC_LF] & CF_WHITESPACE).not.toBe(0);
  });

  it("should classify CR as whitespace", () => {
    expect(CHAR_TABLE[CC_CR] & CF_WHITESPACE).not.toBe(0);
  });

  it("should not classify 'a' as whitespace", () => {
    expect(CHAR_TABLE[0x61] & CF_WHITESPACE).toBe(0);
  });

  it("should classify * as punctuation", () => {
    expect(CHAR_TABLE[CC_STAR] & CF_PUNCTUATION).not.toBe(0);
  });

  it("should classify _ as punctuation", () => {
    expect(CHAR_TABLE[CC_UNDERSCORE] & CF_PUNCTUATION).not.toBe(0);
  });

  it("should classify ! as punctuation", () => {
    expect(CHAR_TABLE[CC_BANG] & CF_PUNCTUATION).not.toBe(0);
  });

  it("should not classify 'z' as punctuation", () => {
    expect(CHAR_TABLE[0x7a] & CF_PUNCTUATION).toBe(0);
  });

  it("should classify backslash as special", () => {
    expect(CHAR_TABLE[CC_BACKSLASH] & CF_SPECIAL).not.toBe(0);
  });

  it("should classify backtick as special", () => {
    expect(CHAR_TABLE[CC_BACKTICK] & CF_SPECIAL).not.toBe(0);
  });

  it("should classify [ as special", () => {
    expect(CHAR_TABLE[CC_LBRACKET] & CF_SPECIAL).not.toBe(0);
  });

  it("should classify $ as special", () => {
    expect(CHAR_TABLE[CC_DOLLAR] & CF_SPECIAL).not.toBe(0);
  });

  it("should classify < as special", () => {
    expect(CHAR_TABLE[CC_LT] & CF_SPECIAL).not.toBe(0);
  });

  it("should classify & as special", () => {
    expect(CHAR_TABLE[CC_AMP] & CF_SPECIAL).not.toBe(0);
  });

  it("should not classify 'A' as special", () => {
    expect(CHAR_TABLE[0x41] & CF_SPECIAL).toBe(0);
  });

  it("should have a character with multiple flags (e.g. * is punctuation + special)", () => {
    const flags = CHAR_TABLE[CC_STAR];
    expect(flags & CF_PUNCTUATION).not.toBe(0);
    expect(flags & CF_SPECIAL).not.toBe(0);
  });
});
