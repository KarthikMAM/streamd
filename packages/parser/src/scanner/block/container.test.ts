import { describe, expect, it } from "vitest";
import { scanBlockquote } from "./container";
import { BlockKind } from "./types";

describe("scanBlockquote", () => {
  it("should scan a single-line blockquote", () => {
    const r = scanBlockquote("> Hello", 0);
    expect(r.kind).toBe(BlockKind.Blockquote);
    expect(r.end).toBe(7);
  });

  it("should scan a multi-line blockquote", () => {
    const src = "> Line 1\n> Line 2";
    const r = scanBlockquote(src, 0);
    expect(r.kind).toBe(BlockKind.Blockquote);
    expect(r.end).toBe(src.length);
  });

  it("should include blank lines between > lines", () => {
    const src = "> Line 1\n\n> Line 2";
    const r = scanBlockquote(src, 0);
    expect(r.kind).toBe(BlockKind.Blockquote);
    expect(r.end).toBe(src.length);
  });

  it("should stop at non-blockquote line after blank", () => {
    const src = "> Quote\n\nParagraph";
    const r = scanBlockquote(src, 0);
    expect(r.kind).toBe(BlockKind.Blockquote);
    expect(r.end).toBeLessThan(src.length);
  });

  it("should set contentStart past > marker", () => {
    const r = scanBlockquote("> Hello", 0);
    expect(r.contentStart).toBe(2);
  });
});
