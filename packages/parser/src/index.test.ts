import { describe, expect, it } from "vitest";
import { parse } from "./index";

describe("parse", () => {
  it("should return empty array for empty input", () => {
    expect(parse("")).toEqual([]);
  });

  it("should split input by newlines", () => {
    expect(parse("hello\nworld")).toEqual(["hello", "world"]);
  });

  it("should handle single line input", () => {
    expect(parse("hello")).toEqual(["hello"]);
  });
});
