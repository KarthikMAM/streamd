import { describe, expect, it } from "vitest";
import { normalizeLabel, unescapeString } from "./normalize";

describe("normalizeLabel", () => {
  it("should lowercase the label", () => {
    expect(normalizeLabel("FOO")).toBe("foo");
  });

  it("should strip leading whitespace", () => {
    expect(normalizeLabel("  foo")).toBe("foo");
  });

  it("should strip trailing whitespace", () => {
    expect(normalizeLabel("foo  ")).toBe("foo");
  });

  it("should collapse internal whitespace to single space", () => {
    expect(normalizeLabel("foo   bar")).toBe("foo bar");
  });

  it("should collapse tabs and newlines", () => {
    expect(normalizeLabel("foo\t\nbar")).toBe("foo bar");
  });

  it("should return empty string for empty input", () => {
    expect(normalizeLabel("")).toBe("");
  });

  it("should return empty string for whitespace-only input", () => {
    expect(normalizeLabel("   \t\n  ")).toBe("");
  });

  it("should handle single character", () => {
    expect(normalizeLabel("A")).toBe("a");
  });

  it("should handle mixed case with internal whitespace", () => {
    expect(normalizeLabel("Foo  BAR  baz")).toBe("foo bar baz");
  });
});

describe("unescapeString", () => {
  it("should return input unchanged when no escapes", () => {
    expect(unescapeString("hello world")).toBe("hello world");
  });

  it("should unescape backslash + punctuation", () => {
    expect(unescapeString("\\*")).toBe("*");
  });

  it("should unescape backslash + backslash", () => {
    expect(unescapeString("\\\\")).toBe("\\");
  });

  it("should not unescape backslash + non-punctuation", () => {
    expect(unescapeString("\\a")).toBe("\\a");
  });

  it("should pass through entity references as-is", () => {
    expect(unescapeString("&amp;")).toBe("&amp;");
  });

  it("should handle trailing backslash", () => {
    expect(unescapeString("text\\")).toBe("text\\");
  });

  it("should handle mixed escapes and entities", () => {
    expect(unescapeString("\\*&amp;")).toBe("*&amp;");
  });
});
