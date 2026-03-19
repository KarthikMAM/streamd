import { describe, expect, it } from "vitest";
import { tryTableSeparator } from "./table-separator";

describe("tryTableSeparator", () => {
  it("should parse simple separator", () => {
    const result = tryTableSeparator("|---|", 0, 4);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(1);
    expect(result?.[0]).toBeNull();
  });

  it("should detect left alignment", () => {
    const result = tryTableSeparator("|:---|", 0, 5);
    expect(result).not.toBeNull();
    expect(result?.[0]).toBe("left");
  });

  it("should detect right alignment", () => {
    const result = tryTableSeparator("|---:|", 0, 5);
    expect(result).not.toBeNull();
    expect(result?.[0]).toBe("right");
  });

  it("should detect center alignment", () => {
    const result = tryTableSeparator("|:---:|", 0, 6);
    expect(result).not.toBeNull();
    expect(result?.[0]).toBe("center");
  });

  it("should parse multiple columns", () => {
    const result = tryTableSeparator("|---|:---:|---:|", 0, 15);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(3);
    expect(result?.[0]).toBeNull();
    expect(result?.[1]).toBe("center");
    expect(result?.[2]).toBe("right");
  });

  it("should reject separator without dashes", () => {
    expect(tryTableSeparator("|:::|", 0, 5)).toBeNull();
  });

  it("should return null for empty input", () => {
    expect(tryTableSeparator("", 0, 0)).toBeNull();
  });
});

it("should handle separator without leading pipe", () => {
  const result = tryTableSeparator("---|---", 0, 7);
  expect(result).not.toBeNull();
  expect(result?.length).toBe(2);
});

it("should handle pipe between cells with content after", () => {
  const result = tryTableSeparator("|---|---|", 0, 8);
  expect(result).not.toBeNull();
  expect(result?.length).toBe(2);
});

it("should reject pipe-only without dashes", () => {
  expect(tryTableSeparator("|||", 0, 3)).toBeNull();
});
