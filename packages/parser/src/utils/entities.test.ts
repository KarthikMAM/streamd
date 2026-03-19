import { describe, expect, it } from "vitest";
import { scanNamedEntity, scanNumericEntity } from "./entities";

describe("scanNamedEntity", () => {
  it("should return entity name for valid syntax", () => {
    const result = scanNamedEntity("amp;rest", 0, 8);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("amp");
    expect(result?.end).toBe(4);
  });

  it("should return multi-char entity name", () => {
    const result = scanNamedEntity("nbsp;", 0, 5);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("nbsp");
    expect(result?.end).toBe(5);
  });

  it("should return null when no semicolon found", () => {
    expect(scanNamedEntity("amp", 0, 3)).toBeNull();
  });

  it("should return null for empty name", () => {
    expect(scanNamedEntity(";", 0, 1)).toBeNull();
  });

  it("should return null for non-alphanumeric character in name", () => {
    expect(scanNamedEntity("am p;", 0, 5)).toBeNull();
  });

  it("should return null for empty input", () => {
    expect(scanNamedEntity("", 0, 0)).toBeNull();
  });

  it("should return null when first char is non-alphanumeric", () => {
    expect(scanNamedEntity(" amp;", 0, 5)).toBeNull();
  });

  it("should respect max entity name length", () => {
    const longName = `${"a".repeat(32)};`;
    expect(scanNamedEntity(longName, 0, longName.length)).toBeNull();
  });

  it("should accept entity name at max length", () => {
    const name = `${"a".repeat(31)};`;
    const result = scanNamedEntity(name, 0, name.length);
    expect(result).not.toBeNull();
    expect(result?.end).toBe(32);
  });
});

describe("scanNumericEntity", () => {
  it("should decode decimal entity &#35; to #", () => {
    const result = scanNumericEntity("35;", 0, 3);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("#");
    expect(result?.end).toBe(3);
  });

  it("should decode hex entity &#x23; to #", () => {
    const result = scanNumericEntity("x23;", 0, 4);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("#");
  });

  it("should decode uppercase hex &#X23;", () => {
    const result = scanNumericEntity("X23;", 0, 4);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("#");
  });

  it("should replace code point 0 with U+FFFD", () => {
    const result = scanNumericEntity("0;", 0, 2);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("\uFFFD");
  });

  it("should replace code point > 0x10FFFF with U+FFFD", () => {
    const result = scanNumericEntity("x110000;", 0, 8);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("\uFFFD");
  });

  it("should return null for no digits", () => {
    expect(scanNumericEntity(";", 0, 1)).toBeNull();
  });

  it("should return null for no semicolon", () => {
    expect(scanNumericEntity("35", 0, 2)).toBeNull();
  });

  it("should return null for empty input", () => {
    expect(scanNumericEntity("", 0, 0)).toBeNull();
  });

  it("should handle hex digits a-f", () => {
    const result = scanNumericEntity("xff;", 0, 4);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("\u00FF");
  });

  it("should handle hex digits A-F", () => {
    const result = scanNumericEntity("XFF;", 0, 4);
    expect(result).not.toBeNull();
    expect(result?.content).toBe("\u00FF");
  });
});
