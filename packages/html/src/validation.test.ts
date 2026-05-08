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
    expect(() => renderHtml(42 as unknown as Array<never>)).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(/renderHtml.*number|number.*renderHtml/),
      }),
    );
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
    expect(() => renderHtml(null as unknown as Array<never>)).toThrow(
      expect.objectContaining({
        kind: "tokens-not-array",
        source: "@streamd/html",
        caller: "renderHtml",
        name: "StreamdHtmlArgumentError",
      }),
    );
  });

  it("is a TypeError subclass", () => {
    expect(() => renderHtml(null as unknown as Array<never>)).toThrow(TypeError);
  });
});
