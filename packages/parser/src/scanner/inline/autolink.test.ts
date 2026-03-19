import { describe, expect, it } from "vitest";
import { TokenType } from "../../types/token-type";
import { matchProtocolPrefix, scanAutolink, scanGfmAutolink } from "./autolink";

describe("scanAutolink", () => {
  it("should detect URI autolink", () => {
    const result = scanAutolink("<http://example.com>", 0, 20);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.Link);
    if (result?.token.type === TokenType.Link) {
      expect(result?.token.href).toBe("http://example.com");
    }
    expect(result?.end).toBe(20);
  });

  it("should detect email autolink", () => {
    const result = scanAutolink("<foo@bar.com>", 0, 13);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Link) {
      expect(result?.token.href).toBe("mailto:foo@bar.com");
    }
  });

  it("should return null for non-autolink", () => {
    expect(scanAutolink("<not an autolink", 0, 16)).toBeNull();
  });

  it("should return null when too short", () => {
    expect(scanAutolink("<", 0, 1)).toBeNull();
  });

  it("should reject URI with space", () => {
    expect(scanAutolink("<http://ex ample.com>", 0, 21)).toBeNull();
  });

  it("should reject email without dot in domain", () => {
    expect(scanAutolink("<foo@bar>", 0, 9)).toBeNull();
  });
});

describe("matchProtocolPrefix", () => {
  it("should match http://", () => {
    expect(matchProtocolPrefix("http://example", 0, 14)).toBe(7);
  });

  it("should match https://", () => {
    expect(matchProtocolPrefix("https://example", 0, 15)).toBe(8);
  });

  it("should match case-insensitively", () => {
    expect(matchProtocolPrefix("HTTP://example", 0, 14)).toBe(7);
  });

  it("should return -1 for non-protocol", () => {
    expect(matchProtocolPrefix("ftp://example", 0, 13)).toBe(-1);
  });

  it("should return -1 when too short", () => {
    expect(matchProtocolPrefix("http", 0, 4)).toBe(-1);
  });
});

describe("scanGfmAutolink", () => {
  it("should detect http:// URL", () => {
    const result = scanGfmAutolink("http://example.com rest", 0, 23);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Link) {
      expect(result?.token.href).toContain("http://example.com");
    }
  });

  it("should detect www. URL", () => {
    const result = scanGfmAutolink("www.example.com rest", 0, 20);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Link) {
      expect(result?.token.href).toContain("http://www.example.com");
    }
  });

  it("should return null for non-URL text", () => {
    expect(scanGfmAutolink("just text", 0, 9)).toBeNull();
  });

  it("should return null for www. with nothing after", () => {
    expect(scanGfmAutolink("www.", 0, 4)).toBeNull();
  });
});
