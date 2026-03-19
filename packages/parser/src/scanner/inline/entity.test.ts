import { describe, expect, it } from "vitest";
import { TokenType } from "../../types/token-type";
import { scanEntity } from "./entity";

describe("scanEntity", () => {
  it("should emit raw text for named entity &amp;", () => {
    const result = scanEntity("&amp;", 0, 5);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.Text);
    if (result?.token.type === TokenType.Text) {
      expect(result?.token.content).toBe("&amp;");
    }
    expect(result?.end).toBe(5);
  });

  it("should emit raw text for named entity &lt;", () => {
    const result = scanEntity("&lt;", 0, 4);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Text) {
      expect(result?.token.content).toBe("&lt;");
    }
  });

  it("should decode decimal numeric entity &#35; to #", () => {
    const result = scanEntity("&#35;", 0, 5);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Text) {
      expect(result?.token.content).toBe("#");
    }
  });

  it("should decode hex numeric entity &#x23; to #", () => {
    const result = scanEntity("&#x23;", 0, 6);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Text) {
      expect(result?.token.content).toBe("#");
    }
  });

  it("should return null for invalid entity syntax", () => {
    expect(scanEntity("&;", 0, 2)).toBeNull();
  });

  it("should return null for & at end of string", () => {
    expect(scanEntity("&", 0, 1)).toBeNull();
  });

  it("should return null for & followed by space", () => {
    expect(scanEntity("& ", 0, 2)).toBeNull();
  });
});
