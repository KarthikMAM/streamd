import { describe, expect, it } from "vitest";
import { isOrderedListStart, scanList } from "./list";
import { BlockKind } from "./types";

describe("isOrderedListStart", () => {
  it("should match 1. item", () => {
    expect(isOrderedListStart("1. item", 0, 7)).toBe(true);
  });

  it("should match 10) item", () => {
    expect(isOrderedListStart("10) item", 0, 8)).toBe(true);
  });

  it("should reject missing delimiter", () => {
    expect(isOrderedListStart("1 item", 0, 6)).toBe(false);
  });

  it("should reject missing space after delimiter", () => {
    expect(isOrderedListStart("1.item", 0, 6)).toBe(false);
  });

  it("should reject non-digit start", () => {
    expect(isOrderedListStart("a. item", 0, 7)).toBe(false);
  });

  it("should reject more than 9 digits", () => {
    expect(isOrderedListStart("1234567890. item", 0, 16)).toBe(false);
  });

  it("should accept exactly 9 digits", () => {
    expect(isOrderedListStart("123456789. item", 0, 15)).toBe(true);
  });
});

describe("scanList", () => {
  it("should scan unordered list", () => {
    const src = "- Item 1\n- Item 2\n- Item 3";
    const r = scanList(src, 0, false, false);
    expect(r.kind).toBe(BlockKind.List);
    expect(r.ordered).toBe(false);
    expect(r.end).toBe(src.length);
  });

  it("should scan ordered list with start number", () => {
    const src = "3. First\n4. Second";
    const r = scanList(src, 0, true, false);
    expect(r.kind).toBe(BlockKind.List);
    expect(r.ordered).toBe(true);
    expect(r.listStart).toBe(3);
  });

  it("should include continuation lines", () => {
    const src = "- Item 1\n  continued\n- Item 2";
    const r = scanList(src, 0, false, false);
    expect(r.kind).toBe(BlockKind.List);
    expect(r.end).toBe(src.length);
  });

  it("should stop at non-list content", () => {
    const src = "- Item\nParagraph";
    const r = scanList(src, 0, false, false);
    expect(r.kind).toBe(BlockKind.List);
    expect(r.end).toBeLessThan(src.length);
  });

  it("should preserve taskListItems flag", () => {
    const src = "- [ ] Task";
    const r = scanList(src, 0, false, true);
    expect(r.taskListItems).toBe(true);
  });

  it("should handle blank lines between items", () => {
    const src = "- Item 1\n\n- Item 2";
    const r = scanList(src, 0, false, false);
    expect(r.kind).toBe(BlockKind.List);
    expect(r.end).toBe(src.length);
  });

  it("should stop after blank line if next line is not a list item", () => {
    const src = "- Item\n\nParagraph";
    const r = scanList(src, 0, false, false);
    expect(r.end).toBeLessThan(src.length);
  });

  it("should handle multiple blank lines between items", () => {
    const src = "- Item 1\n\n\n- Item 2";
    const r = scanList(src, 0, false, false);
    expect(r.kind).toBe(BlockKind.List);
  });

  it("should enforce same marker for unordered lists", () => {
    const src = "- Item 1\n* Item 2";
    const r = scanList(src, 0, false, false);
    // Second item uses different marker, should stop
    expect(r.end).toBeLessThan(src.length);
  });
});
