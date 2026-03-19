import { describe, expect, it } from "vitest";
import { TokenType } from "../../types/token-type";
import { scanCodeSpan } from "./code";

describe("scanCodeSpan", () => {
  it("should match single backtick code span", () => {
    const result = scanCodeSpan("`code`", 0, 6);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.CodeSpan);
    if (result?.token.type === TokenType.CodeSpan) {
      expect(result?.token.content).toBe("code");
    }
    expect(result?.end).toBe(6);
  });

  it("should match double backtick code span", () => {
    const result = scanCodeSpan("`` code ``", 0, 10);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.CodeSpan) {
      expect(result?.token.content).toBe("code");
    }
  });

  it("should allow backtick inside double-backtick span", () => {
    const result = scanCodeSpan("`` ` ``", 0, 7);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.CodeSpan) {
      expect(result?.token.content).toBe("`");
    }
  });

  it("should strip one leading and trailing space when both present", () => {
    const result = scanCodeSpan("` code `", 0, 8);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.CodeSpan) {
      expect(result?.token.content).toBe("code");
    }
  });

  it("should not strip spaces when content is all spaces", () => {
    const result = scanCodeSpan("`   `", 0, 5);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.CodeSpan) {
      expect(result?.token.content).toBe("   ");
    }
  });

  it("should replace line endings with spaces", () => {
    const result = scanCodeSpan("`foo\nbar`", 0, 9);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.CodeSpan) {
      expect(result?.token.content).toBe("foo bar");
    }
  });

  it("should return null when no matching closer", () => {
    expect(scanCodeSpan("`unclosed", 0, 9)).toBeNull();
  });

  it("should return null when closer has different length", () => {
    expect(scanCodeSpan("``code`", 0, 7)).toBeNull();
  });

  it("should return null for empty input", () => {
    expect(scanCodeSpan("", 0, 0)).toBeNull();
  });

  it("should handle CRLF line endings", () => {
    const result = scanCodeSpan("`foo\r\nbar`", 0, 10);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.CodeSpan) {
      expect(result?.token.content).toBe("foo bar");
    }
  });
});
