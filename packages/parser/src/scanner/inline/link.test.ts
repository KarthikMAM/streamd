import { describe, expect, it } from "vitest";
import type { LinkReference } from "../../types/internal";
import { TokenType } from "../../types/token-type";
import { scanLinkOrImage } from "./link";

const emptyRefMap = new Map<string, LinkReference>();

describe("scanLinkOrImage", () => {
  it("should parse inline link [text](url)", () => {
    const result = scanLinkOrImage("[click](http://x.com)", 0, 21, false, emptyRefMap);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.Link);
    if (result?.token.type === TokenType.Link) {
      expect(result?.token.href).toBe("http://x.com");
    }
  });

  it("should parse inline link with title", () => {
    const result = scanLinkOrImage('[t](url "title")', 0, 16, false, emptyRefMap);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Link) {
      expect(result?.token.title).toBe("title");
    }
  });

  it("should parse empty inline link [text]()", () => {
    const result = scanLinkOrImage("[text]()", 0, 8, false, emptyRefMap);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Link) {
      expect(result?.token.href).toBe("");
    }
  });

  it("should parse image ![alt](src)", () => {
    const result = scanLinkOrImage("![alt](img.png)", 0, 15, true, emptyRefMap);
    expect(result).not.toBeNull();
    expect(result?.token.type).toBe(TokenType.Image);
    if (result?.token.type === TokenType.Image) {
      expect(result?.token.src).toBe("img.png");
      expect(result?.token.alt).toBe("alt");
    }
  });

  it("should return null for image without ![", () => {
    expect(scanLinkOrImage("!text", 0, 5, true, emptyRefMap)).toBeNull();
  });

  it("should parse full reference link [text][label]", () => {
    const refMap = new Map<string, LinkReference>();
    refMap.set("label", { destination: "http://x.com", title: "t" });

    const result = scanLinkOrImage("[text][label]", 0, 13, false, refMap);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Link) {
      expect(result?.token.href).toBe("http://x.com");
      expect(result?.token.title).toBe("t");
    }
  });

  it("should parse collapsed reference [text][]", () => {
    const refMap = new Map<string, LinkReference>();
    refMap.set("text", { destination: "http://x.com", title: "" });

    const result = scanLinkOrImage("[text][]", 0, 8, false, refMap);
    expect(result).not.toBeNull();
    if (result?.token.type === TokenType.Link) {
      expect(result?.token.href).toBe("http://x.com");
    }
  });

  it("should parse shortcut reference [text]", () => {
    const refMap = new Map<string, LinkReference>();
    refMap.set("text", { destination: "http://x.com", title: "" });

    const result = scanLinkOrImage("[text]", 0, 6, false, refMap);
    expect(result).not.toBeNull();
  });

  it("should return null for unmatched [", () => {
    expect(scanLinkOrImage("[unclosed", 0, 9, false, emptyRefMap)).toBeNull();
  });

  it("should return null for unresolved reference", () => {
    expect(scanLinkOrImage("[text][missing]", 0, 15, false, emptyRefMap)).toBeNull();
  });

  it("should handle escaped brackets in text", () => {
    const result = scanLinkOrImage("[te\\]xt](url)", 0, 13, false, emptyRefMap);
    expect(result).not.toBeNull();
  });
});
