import { describe, expect, it } from "vitest";
import type { LinkReference } from "../types/internal";
import { parseLinkDestination, parseLinkTitle, scanLinkRefDef } from "./references";

describe("scanLinkRefDef", () => {
  it("should parse basic ref def [label]: url", () => {
    const refMap = new Map<string, LinkReference>();
    const result = scanLinkRefDef("[foo]: /url\n", 0, 12, refMap);
    expect(result).not.toBeNull();
    expect(refMap.get("foo")).toEqual({ destination: "/url", title: "" });
  });

  it("should parse ref def with title", () => {
    const refMap = new Map<string, LinkReference>();
    const result = scanLinkRefDef('[foo]: /url "title"\n', 0, 20, refMap);
    expect(result).not.toBeNull();
    expect(refMap.get("foo")?.title).toBe("title");
  });

  it("should normalize label to lowercase", () => {
    const refMap = new Map<string, LinkReference>();
    scanLinkRefDef("[FOO]: /url\n", 0, 12, refMap);
    expect(refMap.has("foo")).toBe(true);
  });

  it("should keep first definition when duplicate", () => {
    const refMap = new Map<string, LinkReference>();
    scanLinkRefDef("[foo]: /first\n", 0, 14, refMap);
    scanLinkRefDef("[foo]: /second\n", 0, 15, refMap);
    expect(refMap.get("foo")?.destination).toBe("/first");
  });

  it("should return null for missing colon", () => {
    const refMap = new Map<string, LinkReference>();
    expect(scanLinkRefDef("[foo] /url\n", 0, 11, refMap)).toBeNull();
  });

  it("should return null for empty label", () => {
    const refMap = new Map<string, LinkReference>();
    expect(scanLinkRefDef("[]: /url\n", 0, 9, refMap)).toBeNull();
  });

  it("should return null when not starting with [", () => {
    const refMap = new Map<string, LinkReference>();
    expect(scanLinkRefDef("foo: /url\n", 0, 10, refMap)).toBeNull();
  });

  it("should parse angle-bracket destination", () => {
    const refMap = new Map<string, LinkReference>();
    scanLinkRefDef("[foo]: <http://example.com>\n", 0, 27, refMap);
    expect(refMap.get("foo")?.destination).toBe("http://example.com");
  });
});

describe("parseLinkDestination", () => {
  it("should parse bare URL", () => {
    const result = parseLinkDestination("/url", 0, 4);
    expect(result).not.toBeNull();
    expect(result?.destination).toBe("/url");
    expect(result?.end).toBe(4);
  });

  it("should parse angle-bracket URL", () => {
    const result = parseLinkDestination("<http://x.com>", 0, 14);
    expect(result).not.toBeNull();
    expect(result?.destination).toBe("http://x.com");
  });

  it("should handle balanced parentheses in bare URL", () => {
    const result = parseLinkDestination("/url(foo)", 0, 9);
    expect(result).not.toBeNull();
    expect(result?.destination).toBe("/url(foo)");
  });

  it("should reject unbalanced parentheses", () => {
    expect(parseLinkDestination("/url(()", 0, 7)).toBeNull();
  });

  it("should stop at space in bare URL", () => {
    const result = parseLinkDestination("/url rest", 0, 9);
    expect(result).not.toBeNull();
    expect(result?.destination).toBe("/url");
    expect(result?.end).toBe(4);
  });

  it("should return null for empty input", () => {
    expect(parseLinkDestination("", 0, 0)).toBeNull();
  });

  it("should reject < inside angle-bracket URL", () => {
    expect(parseLinkDestination("<url<bad>", 0, 9)).toBeNull();
  });

  it("should handle backslash escapes in angle-bracket URL", () => {
    const result = parseLinkDestination("<url\\>more>", 0, 11);
    expect(result).not.toBeNull();
    expect(result?.destination).toBe("url>more");
  });
});

describe("parseLinkTitle", () => {
  it("should parse double-quoted title", () => {
    const result = parseLinkTitle('"title"', 0, 7);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("title");
  });

  it("should parse single-quoted title", () => {
    const result = parseLinkTitle("'title'", 0, 7);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("title");
  });

  it("should parse paren-delimited title", () => {
    const result = parseLinkTitle("(title)", 0, 7);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("title");
  });

  it("should handle backslash escapes in title", () => {
    const result = parseLinkTitle('"ti\\"tle"', 0, 9);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('ti"tle');
  });

  it("should return null for unclosed title", () => {
    expect(parseLinkTitle('"unclosed', 0, 9)).toBeNull();
  });

  it("should return null for non-title opener", () => {
    expect(parseLinkTitle("abc", 0, 3)).toBeNull();
  });

  it("should return null for empty input", () => {
    expect(parseLinkTitle("", 0, 0)).toBeNull();
  });
});
