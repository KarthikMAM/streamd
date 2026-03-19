import { describe, expect, it } from "vitest";
import { TokenType } from "../../types/token-type";
import { scanMathInline } from "./math";

describe("scanMathInline", () => {
  it("should match $content$", () => {
    const result = scanMathInline("$E=mc^2$", 0, 8);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.MathInline);
    if (result?.token.type === TokenType.MathInline) {
      expect(result?.token.content).toBe("E=mc^2");
    }
    expect(result?.end).toBe(8);
  });

  it("should return null for $$ (block math delimiter)", () => {
    expect(scanMathInline("$$block$$", 0, 9)).toBeNull();
  });

  it("should return null for empty content $$ ", () => {
    expect(scanMathInline("$$", 0, 2)).toBeNull();
  });

  it("should return null for unclosed $", () => {
    expect(scanMathInline("$unclosed", 0, 9)).toBeNull();
  });

  it("should return null when $ is at end of string", () => {
    expect(scanMathInline("$", 0, 1)).toBeNull();
  });

  it("should return null when content contains newline", () => {
    expect(scanMathInline("$a\nb$", 0, 5)).toBeNull();
  });

  it("should handle backslash escapes inside math", () => {
    const result = scanMathInline("$a\\$b$", 0, 6);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.MathInline) {
      expect(result?.token.content).toBe("a\\$b");
    }
  });

  it("should skip $$ inside content", () => {
    const result = scanMathInline("$a$$b$", 0, 6);
    expect(result).not.toBeNull();
  });
});
