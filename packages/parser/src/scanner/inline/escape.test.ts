import { describe, expect, it } from "vitest";
import { TokenType } from "../../types/token-type";
import { scanEscape } from "./escape";

describe("scanEscape", () => {
  it("should escape ASCII punctuation", () => {
    const result = scanEscape("\\*", 0, 2);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.Escape);
    if (result?.token.type === TokenType.Escape) {
      expect(result?.token.content).toBe("*");
    }
    expect(result?.end).toBe(2);
  });

  it("should escape backslash", () => {
    const result = scanEscape("\\\\", 0, 2);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Escape) {
      expect(result?.token.content).toBe("\\");
    }
  });

  it("should produce hardbreak for backslash before LF", () => {
    const result = scanEscape("\\\n", 0, 2);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.Hardbreak);
    expect(result?.end).toBe(2);
  });

  it("should produce hardbreak for backslash before CRLF", () => {
    const result = scanEscape("\\\r\n", 0, 3);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.Hardbreak);
    expect(result?.end).toBe(3);
  });

  it("should return null for backslash before non-punctuation", () => {
    expect(scanEscape("\\a", 0, 2)).toBeNull();
  });

  it("should return null for backslash at end of string", () => {
    expect(scanEscape("\\", 0, 1)).toBeNull();
  });

  it("should return null when next char is beyond end", () => {
    expect(scanEscape("\\*extra", 0, 1)).toBeNull();
  });
});
