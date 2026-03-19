import { describe, expect, it } from "vitest";
import { scanDelimiterRun } from "./emphasis";

describe("scanDelimiterRun", () => {
  it("should count consecutive * characters", () => {
    const result = scanDelimiterRun("**foo", 0, 5);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(2);
  });

  it("should count consecutive _ characters", () => {
    const result = scanDelimiterRun("___foo", 0, 6);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(3);
  });

  it("should count consecutive ~ characters", () => {
    const result = scanDelimiterRun("~~foo", 0, 5);
    expect(result).not.toBeNull();
    expect(result?.count).toBe(2);
  });

  it("should return null for non-delimiter character", () => {
    expect(scanDelimiterRun("abc", 0, 3)).toBeNull();
  });

  it("should classify left-flanking * as canOpen", () => {
    const result = scanDelimiterRun("*foo", 0, 4);
    expect(result?.canOpen).toBe(true);
  });

  it("should classify right-flanking * as canClose", () => {
    const result = scanDelimiterRun("foo*", 3, 4);
    expect(result?.canClose).toBe(true);
  });

  it("should not classify * preceded by whitespace as canClose", () => {
    const result = scanDelimiterRun(" *foo", 1, 5);
    expect(result?.canClose).toBe(false);
  });

  it("should apply underscore intraword restriction for canOpen", () => {
    const result = scanDelimiterRun("a_b", 1, 3);
    expect(result?.canOpen).toBe(false);
  });

  it("should allow underscore canOpen after punctuation", () => {
    const result = scanDelimiterRun("._b", 1, 3);
    expect(result?.canOpen).toBe(true);
  });

  it("should classify * at start of string as canOpen", () => {
    const result = scanDelimiterRun("*foo", 0, 4);
    expect(result?.canOpen).toBe(true);
    expect(result?.canClose).toBe(false);
  });

  it("should classify * at end of string as canClose", () => {
    const result = scanDelimiterRun("foo*", 3, 4);
    expect(result?.canClose).toBe(true);
    expect(result?.canOpen).toBe(false);
  });
});
