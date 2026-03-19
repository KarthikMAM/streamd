import { describe, expect, it } from "vitest";
import { createParser, parse } from "./parser";
import { TokenType } from "./types/token-type";

describe("parse — full document", () => {
  it("should parse empty string", () => {
    const { tokens, stableCount } = parse("");
    expect(tokens.length).toBe(0);
    expect(stableCount).toBe(0);
  });

  it("should parse single paragraph", () => {
    const { tokens } = parse("Hello world");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.Paragraph);
  });

  it("should parse multiple blocks", () => {
    const { tokens } = parse("# Title\n\nParagraph");
    expect(tokens.length).toBe(2);
  });

  it("should return stableCount equal to token count", () => {
    const { tokens, stableCount } = parse("# Hello");
    expect(stableCount).toBe(tokens.length);
  });

  it("should return a state object", () => {
    const { state } = parse("# Hello");
    expect(state).toBeDefined();
  });

  it("should resolve GFM options", () => {
    const { tokens } = parse("~~strike~~", null, { gfm: true });
    expect(tokens.length).toBe(1);
  });

  it("should enable math when option set", () => {
    const { tokens } = parse("$$\nx\n$$", null, { math: true });
    expect(tokens[0]?.type).toBe(TokenType.MathBlock);
  });
});

describe("parse — streaming", () => {
  it("should parse chunks incrementally", () => {
    const r1 = parse("# Hello\n");
    const r2 = parse("World\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThan(0);
  });

  it("should flush with empty string", () => {
    const r1 = parse("# Hello\n");
    const r2 = parse("", r1.state);
    expect(r2.tokens.length).toBeGreaterThan(0);
    expect(r2.stableCount).toBe(r2.tokens.length);
  });

  it("should handle incomplete lines", () => {
    const r1 = parse("# Hel");
    const r2 = parse("lo\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThan(0);
  });

  it("should handle empty first chunk then content", () => {
    const r1 = parse("");
    const r2 = parse("# Hello\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThan(0);
  });

  it("should handle chunk with no complete lines", () => {
    const r1 = parse("abc");
    const r2 = parse("def", r1.state);
    // No complete lines yet — should return empty or minimal
    const r3 = parse("\n", r2.state);
    expect(r3.tokens.length).toBeGreaterThan(0);
  });

  it("should return stableCount less than total for streaming", () => {
    const r1 = parse("# Hello\n");
    const r2 = parse("Para\n", r1.state);
    expect(r2.stableCount).toBeLessThanOrEqual(r2.tokens.length);
  });
});

describe("createParser", () => {
  it("should create a bound parse function", () => {
    const p = createParser();
    const { tokens } = p("# Hello");
    expect(tokens.length).toBe(1);
  });

  it("should snapshot options at creation time", () => {
    const p = createParser({ math: true });
    const { tokens } = p("$$\nx\n$$");
    expect(tokens[0]?.type).toBe(TokenType.MathBlock);
  });

  it("should support streaming via bound function", () => {
    const p = createParser();
    const { state } = p("# Hello\n");
    const { tokens } = p("", state);
    expect(tokens.length).toBeGreaterThan(0);
  });
});
