/**
 * Unit tests for escape / entity / URL helpers.
 *
 * @module escape.test
 */

import { describe, expect, it } from "vitest";
import { decodeEntities, escapeAttr, escapeHtml, normalizeUrl } from "./escape";

describe("escapeHtml", () => {
  it("leaves plain ASCII untouched", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  it('escapes < > & "', () => {
    expect(escapeHtml('<a href="x">&amp;</a>')).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;amp;&lt;/a&gt;",
    );
  });

  it("leaves apostrophe untouched (not required in body text)", () => {
    expect(escapeHtml("it's fine")).toBe("it's fine");
  });
});

describe("escapeAttr", () => {
  it("escapes apostrophe as &#39;", () => {
    expect(escapeAttr("it's fine")).toBe("it&#39;s fine");
  });

  it("escapes double quote", () => {
    expect(escapeAttr('a"b')).toBe("a&quot;b");
  });
});

describe("normalizeUrl", () => {
  it("leaves a clean URL untouched", () => {
    expect(normalizeUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("percent-encodes spaces", () => {
    expect(normalizeUrl("a b c")).toBe("a%20b%20c");
  });

  it("preserves existing percent-escapes", () => {
    expect(normalizeUrl("a%20b")).toBe("a%20b");
  });

  it("encodes unicode characters as utf-8 bytes", () => {
    expect(normalizeUrl("foo/\u00e9")).toBe("foo/%C3%A9");
  });
});

describe("decodeEntities", () => {
  it("returns input unchanged when no & present", () => {
    expect(decodeEntities("hello")).toBe("hello");
  });

  it("decodes named entity", () => {
    expect(decodeEntities("&nbsp;")).toBe("\u00a0");
  });

  it("decodes numeric entity", () => {
    expect(decodeEntities("&#65;")).toBe("A");
  });

  it("decodes hex numeric entity", () => {
    expect(decodeEntities("&#x42;")).toBe("B");
  });

  it("passes through unknown named entity", () => {
    expect(decodeEntities("&notARealEntity;")).toBe("&notARealEntity;");
  });

  it("passes through orphan ampersand", () => {
    expect(decodeEntities("a & b")).toBe("a & b");
  });

  it("handles mixed content", () => {
    expect(decodeEntities("hello &amp; &copy; world")).toBe("hello & \u00a9 world");
  });
});
