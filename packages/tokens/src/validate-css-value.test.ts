/**
 * Unit tests for the CSS value safety predicates.
 *
 * One describe block per exported predicate. Each block covers:
 * - Representative accept cases (every syntactic form the predicate
 *   permits).
 * - Targeted reject cases for every CSS-structural character the
 *   predicate is supposed to catch.
 * - Boundary cases (empty string, NaN, Infinity, unmatched quotes).
 *
 * @module validate-css-value.test
 */

import { describe, expect, it } from "vitest";
import {
  isSafeColor,
  isSafeFontFamily,
  isSafeLength,
  isSafeNumericString,
} from "./validate-css-value";

describe("isSafeColor — accepts", () => {
  it("3-digit hex", () => {
    expect(isSafeColor("#fff")).toBe(true);
  });

  it("4-digit hex with alpha", () => {
    expect(isSafeColor("#fff0")).toBe(true);
  });

  it("6-digit hex", () => {
    expect(isSafeColor("#1f2328")).toBe(true);
  });

  it("8-digit hex with alpha", () => {
    expect(isSafeColor("#1f2328aa")).toBe(true);
  });

  it("uppercase hex (case-insensitive)", () => {
    expect(isSafeColor("#ABCDEF")).toBe(true);
  });

  it("rgb() function", () => {
    expect(isSafeColor("rgb(255 0 0)")).toBe(true);
  });

  it("rgba() function", () => {
    expect(isSafeColor("rgba(255, 0, 0, 0.5)")).toBe(true);
  });

  it("hsl() function", () => {
    expect(isSafeColor("hsl(210 50% 50%)")).toBe(true);
  });

  it("hsla() function", () => {
    expect(isSafeColor("hsla(210, 50%, 50%, 0.8)")).toBe(true);
  });

  it("hwb() function", () => {
    expect(isSafeColor("hwb(210 30% 20%)")).toBe(true);
  });

  it("oklch() function", () => {
    expect(isSafeColor("oklch(0.7 0.15 200)")).toBe(true);
  });

  it("oklab() function", () => {
    expect(isSafeColor("oklab(0.7 0.1 0.1)")).toBe(true);
  });

  it("lab() function", () => {
    expect(isSafeColor("lab(50% 40 59)")).toBe(true);
  });

  it("lch() function", () => {
    expect(isSafeColor("lch(50% 80 120)")).toBe(true);
  });

  it("color() function", () => {
    expect(isSafeColor("color(display-p3 1 0 0)")).toBe(true);
  });

  it("transparent keyword", () => {
    expect(isSafeColor("transparent")).toBe(true);
  });

  it("currentColor keyword (case-insensitive)", () => {
    expect(isSafeColor("currentColor")).toBe(true);
    expect(isSafeColor("CURRENTCOLOR")).toBe(true);
  });

  it("named Level 4 keywords", () => {
    expect(isSafeColor("red")).toBe(true);
    expect(isSafeColor("aliceblue")).toBe(true);
    expect(isSafeColor("rebeccapurple")).toBe(true);
  });

  it("named keyword with mixed case", () => {
    expect(isSafeColor("Red")).toBe(true);
    expect(isSafeColor("REBECCAPURPLE")).toBe(true);
  });
});

describe("isSafeColor — rejects", () => {
  it("empty string", () => {
    expect(isSafeColor("")).toBe(false);
  });

  it("value with semicolon (rule-block escape)", () => {
    expect(isSafeColor("red;")).toBe(false);
  });

  it("the canonical injection payload", () => {
    expect(isSafeColor("red; } body { display: none; } .foo {")).toBe(false);
  });

  it("value with open brace", () => {
    expect(isSafeColor("red{")).toBe(false);
  });

  it("value with close brace", () => {
    expect(isSafeColor("red}")).toBe(false);
  });

  it("value with newline", () => {
    expect(isSafeColor("red\n")).toBe(false);
  });

  it("value with carriage return", () => {
    expect(isSafeColor("red\r")).toBe(false);
  });

  it("value with block-comment open", () => {
    expect(isSafeColor("red/*foo*/")).toBe(false);
  });

  it("value with block-comment close", () => {
    expect(isSafeColor("red*/trail")).toBe(false);
  });

  it("value with HTML-tag opener", () => {
    expect(isSafeColor("red<script>")).toBe(false);
  });

  it("hex with wrong length", () => {
    expect(isSafeColor("#ff")).toBe(false);
    expect(isSafeColor("#fffff")).toBe(false);
    expect(isSafeColor("#fffffff")).toBe(false);
  });

  it("hex with non-hex character", () => {
    expect(isSafeColor("#gggggg")).toBe(false);
  });

  it("unknown function name", () => {
    expect(isSafeColor("evil(foo)")).toBe(false);
  });

  it("color function without trailing paren", () => {
    expect(isSafeColor("rgb(255 0 0")).toBe(false);
  });

  it("unknown named keyword", () => {
    expect(isSafeColor("notacolor")).toBe(false);
  });

  it("bare identifier with no paren", () => {
    expect(isSafeColor("url")).toBe(false);
  });
});

describe("isSafeLength", () => {
  it("accepts zero", () => {
    expect(isSafeLength(0)).toBe(true);
  });

  it("accepts small positive integer", () => {
    expect(isSafeLength(16)).toBe(true);
  });

  it("accepts fractional positive", () => {
    expect(isSafeLength(1.6)).toBe(true);
  });

  it("accepts negative finite", () => {
    expect(isSafeLength(-4)).toBe(true);
  });

  it("rejects NaN", () => {
    expect(isSafeLength(Number.NaN)).toBe(false);
  });

  it("rejects positive Infinity", () => {
    expect(isSafeLength(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("rejects negative Infinity", () => {
    expect(isSafeLength(Number.NEGATIVE_INFINITY)).toBe(false);
  });
});

describe("isSafeFontFamily — accepts", () => {
  it("single bare family", () => {
    expect(isSafeFontFamily("Helvetica")).toBe(true);
  });

  it("family list with commas and spaces", () => {
    expect(isSafeFontFamily("Helvetica, Arial, sans-serif")).toBe(true);
  });

  it("quoted family name with double quotes", () => {
    expect(isSafeFontFamily('"Helvetica Neue", Arial, sans-serif')).toBe(true);
  });

  it("quoted family name with single quotes", () => {
    expect(isSafeFontFamily("'Helvetica Neue', Arial, sans-serif")).toBe(true);
  });

  it("the default theme font stack", () => {
    const stack =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, " +
      "Cantarell, 'Helvetica Neue', Arial, sans-serif";
    expect(isSafeFontFamily(stack)).toBe(true);
  });
});

describe("isSafeFontFamily — rejects", () => {
  it("empty string", () => {
    expect(isSafeFontFamily("")).toBe(false);
  });

  it("value with semicolon", () => {
    expect(isSafeFontFamily("Helvetica;")).toBe(false);
  });

  it("value with open brace", () => {
    expect(isSafeFontFamily("Helvetica{")).toBe(false);
  });

  it("value with close brace", () => {
    expect(isSafeFontFamily("Helvetica}")).toBe(false);
  });

  it("value with newline", () => {
    expect(isSafeFontFamily("Helvetica\n")).toBe(false);
  });

  it("value with carriage return", () => {
    expect(isSafeFontFamily("Helvetica\r")).toBe(false);
  });

  it("odd count of double quotes", () => {
    expect(isSafeFontFamily('"Helvetica Neue, Arial')).toBe(false);
  });

  it("odd count of single quotes", () => {
    expect(isSafeFontFamily("'Helvetica Neue, Arial")).toBe(false);
  });

  it("the canonical injection payload", () => {
    expect(isSafeFontFamily("Arial; } body { display: none; } .foo {")).toBe(false);
  });
});

describe("isSafeNumericString — accepts", () => {
  it("single digit", () => {
    expect(isSafeNumericString("0")).toBe(true);
  });

  it("multi-digit integer", () => {
    expect(isSafeNumericString("400")).toBe(true);
  });

  it("decimal", () => {
    expect(isSafeNumericString("1.6")).toBe(true);
  });

  it("long fractional", () => {
    expect(isSafeNumericString("1.234567")).toBe(true);
  });
});

describe("isSafeNumericString — rejects", () => {
  it("empty string", () => {
    expect(isSafeNumericString("")).toBe(false);
  });

  it("leading plus", () => {
    expect(isSafeNumericString("+1")).toBe(false);
  });

  it("leading minus", () => {
    expect(isSafeNumericString("-1")).toBe(false);
  });

  it("trailing dot", () => {
    expect(isSafeNumericString("1.")).toBe(false);
  });

  it("leading dot", () => {
    expect(isSafeNumericString(".5")).toBe(false);
  });

  it("scientific notation", () => {
    expect(isSafeNumericString("1e10")).toBe(false);
  });

  it("embedded separator", () => {
    expect(isSafeNumericString("1,000")).toBe(false);
  });

  it("whitespace-padded", () => {
    expect(isSafeNumericString(" 1 ")).toBe(false);
  });

  it("semicolon injection attempt", () => {
    expect(isSafeNumericString("400; }")).toBe(false);
  });

  it("NaN literal", () => {
    expect(isSafeNumericString("NaN")).toBe(false);
  });

  it("Infinity literal", () => {
    expect(isSafeNumericString("Infinity")).toBe(false);
  });
});
