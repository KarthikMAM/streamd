/**
 * Unit tests for the public-API validation guards.
 *
 * @module validation.test
 */

import { describe, expect, it } from "vitest";
import { renderHtml, StreamdHtmlArgumentError, streamHtml } from "./index";

describe("renderHtml — input validation", () => {
  it("throws when tokens is null", () => {
    expect(() => renderHtml(null as unknown as Array<never>)).toThrow(StreamdHtmlArgumentError);
  });

  it("throws when tokens is undefined", () => {
    expect(() => renderHtml(undefined as unknown as Array<never>)).toThrow(
      StreamdHtmlArgumentError,
    );
  });

  it("throws when tokens is a string", () => {
    expect(() => renderHtml("hello" as unknown as Array<never>)).toThrow(StreamdHtmlArgumentError);
  });

  it("throws when tokens is an object", () => {
    expect(() => renderHtml({} as unknown as Array<never>)).toThrow(StreamdHtmlArgumentError);
  });

  it("accepts an empty array and returns empty string", () => {
    expect(renderHtml([])).toBe("");
  });

  it("error message includes caller name and received type", () => {
    try {
      renderHtml(42 as unknown as Array<never>);
    } catch (err) {
      const e = err as StreamdHtmlArgumentError;
      expect(e.message).toContain("renderHtml");
      expect(e.message).toContain("number");
      return;
    }
    throw new Error("expected throw");
  });
});

describe("streamHtml — input validation", () => {
  it("throws when src is null", () => {
    expect(() => streamHtml(null as unknown as string, null)).toThrow(StreamdHtmlArgumentError);
  });

  it("throws when src is a number", () => {
    expect(() => streamHtml(42 as unknown as string, null)).toThrow(StreamdHtmlArgumentError);
  });

  it("accepts an empty string", () => {
    const result = streamHtml("", null);
    expect(result.html).toBe("");
  });
});

describe("StreamdHtmlArgumentError — shape", () => {
  it("exposes a stable kind discriminator", () => {
    try {
      renderHtml(null as unknown as Array<never>);
    } catch (err) {
      const e = err as StreamdHtmlArgumentError;
      expect(e.kind).toBe("tokens-not-array");
      expect(e.source).toBe("@streamd/html");
      expect(e.caller).toBe("renderHtml");
      expect(e.name).toBe("StreamdHtmlArgumentError");
      return;
    }
    throw new Error("expected throw");
  });

  it("is a TypeError subclass", () => {
    try {
      renderHtml(null as unknown as Array<never>);
    } catch (err) {
      expect(err).toBeInstanceOf(TypeError);
      return;
    }
    throw new Error("expected throw");
  });
});
