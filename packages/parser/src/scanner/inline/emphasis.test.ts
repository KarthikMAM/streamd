/**
 * Unit tests for `scanDelimiterRun` — the `*`/`_`/`~` delimiter-run
 * classifier used by the emphasis and strikethrough resolvers.
 *
 * Covers:
 *  - Run length counting for every supported delimiter character.
 *  - `canOpen` / `canClose` classification per CommonMark §6.2.
 *  - The underscore intraword restriction.
 *  - Whitespace- and punctuation-adjacent flanking rules.
 *  - Boundary cases at start/end of the scan range.
 *
 * @module emphasis.test
 */

import { describe, expect, it } from "vitest";
import { scanDelimiterRun } from "./emphasis";

describe("scanDelimiterRun — run length", () => {
  it("returns count=2 for two consecutive stars", () => {
    const result = scanDelimiterRun("**foo", 0, 5);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
  });

  it("returns count=3 for three consecutive underscores", () => {
    const result = scanDelimiterRun("___foo", 0, 6);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(3);
  });

  it("returns count=2 for two consecutive tildes", () => {
    const result = scanDelimiterRun("~~foo", 0, 5);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(2);
  });

  it("returns null when the starting character is not a delimiter", () => {
    expect(scanDelimiterRun("abc", 0, 3)).toBeNull();
  });
});

describe("scanDelimiterRun — canOpen / canClose flanking", () => {
  it("marks a left-flanking star as canOpen", () => {
    const result = scanDelimiterRun("*foo", 0, 4);
    expect(result).not.toBeNull();
    expect(result!.canOpen).toBe(true);
  });

  it("marks a right-flanking star as canClose", () => {
    const result = scanDelimiterRun("foo*", 3, 4);
    expect(result).not.toBeNull();
    expect(result!.canClose).toBe(true);
  });

  it("does not mark a star preceded by whitespace as canClose", () => {
    const result = scanDelimiterRun(" *foo", 1, 5);
    expect(result).not.toBeNull();
    expect(result!.canClose).toBe(false);
  });

  it("marks a star at the start of string as canOpen-only (not canClose)", () => {
    const result = scanDelimiterRun("*foo", 0, 4);
    expect(result).not.toBeNull();
    expect(result!.canOpen).toBe(true);
    expect(result!.canClose).toBe(false);
  });

  it("marks a star at the end of string as canClose-only (not canOpen)", () => {
    const result = scanDelimiterRun("foo*", 3, 4);
    expect(result).not.toBeNull();
    expect(result!.canClose).toBe(true);
    expect(result!.canOpen).toBe(false);
  });
});

describe("scanDelimiterRun — underscore intraword restriction", () => {
  it("does not mark an underscore between two alphanumerics as canOpen", () => {
    const result = scanDelimiterRun("a_b", 1, 3);
    expect(result).not.toBeNull();
    expect(result!.canOpen).toBe(false);
  });

  it("marks an underscore preceded by punctuation as canOpen", () => {
    const result = scanDelimiterRun("._b", 1, 3);
    expect(result).not.toBeNull();
    expect(result!.canOpen).toBe(true);
  });
});
