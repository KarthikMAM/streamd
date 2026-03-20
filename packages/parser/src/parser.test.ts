import { describe, expect, it } from "vitest";
import { createParser, parse } from "./parser";
import { TokenType } from "./types/token-type";

describe("parse -- full document", () => {
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

describe("parse -- streaming (full source API)", () => {
  it("should parse incrementally with growing source", () => {
    const r1 = parse("# Hello\n");
    const r2 = parse("# Hello\nWorld\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThan(0);
  });

  it("should handle incomplete lines", () => {
    const r1 = parse("# Hel");
    const r2 = parse("# Hello\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThan(0);
  });

  it("should handle same source (no new content)", () => {
    const r1 = parse("# Hello\n");
    const r2 = parse("# Hello\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThan(0);
  });

  it("should handle source with no complete lines yet", () => {
    const r1 = parse("abc");
    const r2 = parse("abcdef", r1.state);
    expect(r2.tokens.length).toBeGreaterThanOrEqual(0);
    const r3 = parse("abcdef\n", r2.state);
    expect(r3.tokens.length).toBeGreaterThan(0);
  });

  it("should return stableCount for completed blocks", () => {
    const r1 = parse("# Hello\n");
    const r2 = parse("# Hello\n\nPara\n", r1.state);
    expect(r2.stableCount).toBeLessThanOrEqual(r2.tokens.length);
  });

  it("should produce correct final tokens", () => {
    const r1 = parse("# Title\n");
    const r2 = parse("# Title\n\nParagraph\n", r1.state);
    expect(r2.tokens.length).toBe(2);
    expect(r2.tokens[0]?.type).toBe(TokenType.Heading);
    expect(r2.tokens[1]?.type).toBe(TokenType.Paragraph);
  });

  it("should handle empty initial parse then content", () => {
    const r1 = parse("");
    const r2 = parse("# Hello\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThan(0);
  });
});

describe("parse -- paragraph text-append fast path", () => {
  it("should extend text token when appending pure words", () => {
    // First call establishes a paragraph with a Text token
    const r1 = parse("Hello ");
    // Second call appends pure text (no special chars, no newline)
    const r2 = parse("Hello world ", r1.state);
    expect(r2.tokens.length).toBe(1);
    expect(r2.tokens[0]?.type).toBe(TokenType.Paragraph);
  });

  it("should fall back to inline re-parse when special char appears", () => {
    const r1 = parse("Hello ");
    // Asterisk triggers delimiter handler — can't use text-append
    const r2 = parse("Hello **bold** ", r1.state);
    expect(r2.tokens.length).toBe(1);
    expect(r2.tokens[0]?.type).toBe(TokenType.Paragraph);
  });

  it("should match full parse output for pure text streaming", () => {
    const words = ["The ", "quick ", "brown ", "fox "];
    let src = "";
    let r = parse(src);
    for (const w of words) {
      src += w;
      r = parse(src, r.state);
    }
    const full = parse(src);
    expect(r.tokens.length).toBe(full.tokens.length);
  });
});

describe("parse -- paragraph continuation fast path", () => {
  it("should produce correct tokens when appending plain text to paragraph", () => {
    const r1 = parse("Hello\n");
    const r2 = parse("Hello\nworld\n", r1.state);
    expect(r2.tokens.length).toBe(1);
    expect(r2.tokens[0]?.type).toBe(TokenType.Paragraph);
  });

  it("should handle multiple appended lines of plain text", () => {
    let src = "First line\n";
    let r = parse(src);
    for (const word of ["Second line\n", "Third line\n", "Fourth line\n"]) {
      src += word;
      r = parse(src, r.state);
    }
    expect(r.tokens.length).toBe(1);
    expect(r.tokens[0]?.type).toBe(TokenType.Paragraph);
  });

  it("should fall back to full scan when heading interrupts paragraph", () => {
    const r1 = parse("Hello\n");
    const r2 = parse("Hello\n# Heading\n", r1.state);
    // Heading interrupts the paragraph — both should be present
    const types = r2.tokens.map((t) => t.type);
    expect(types).toContain(TokenType.Heading);
    expect(types).toContain(TokenType.Paragraph);
  });

  it("should fall back to full scan when blank line appears", () => {
    const r1 = parse("Hello\n");
    const r2 = parse("Hello\n\nWorld\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThanOrEqual(1);
  });

  it("should fall back when blockquote interrupts paragraph", () => {
    const r1 = parse("Hello\n");
    const r2 = parse("Hello\n> quote\n", r1.state);
    expect(r2.tokens.length).toBe(2);
  });

  it("should fall back when fenced code interrupts paragraph", () => {
    const r1 = parse("Hello\n");
    const r2 = parse("Hello\n```\ncode\n```\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThanOrEqual(2);
  });

  it("should preserve inline formatting in continued paragraph", () => {
    const r1 = parse("Hello **bold\n");
    const r2 = parse("Hello **bold** world\n", r1.state);
    expect(r2.tokens.length).toBe(1);
    expect(r2.tokens[0]?.type).toBe(TokenType.Paragraph);
    const para = r2.tokens[0] as { children: Array<{ type: number }> };
    const hasStrong = para.children.some((c) => c.type === TokenType.Strong);
    expect(hasStrong).toBe(true);
  });

  it("should match full parse output for paragraph continuation", () => {
    const src = "Hello\nworld\nfoo bar\n";
    const full = parse(src);

    let streaming = parse("Hello\n");
    streaming = parse("Hello\nworld\n", streaming.state);
    streaming = parse(src, streaming.state);

    expect(streaming.tokens.length).toBe(full.tokens.length);
    expect(streaming.tokens[0]?.type).toBe(full.tokens[0]?.type);
  });
});

describe("parse -- fenced code continuation fast path", () => {
  it("should produce code block when appending lines inside fence", () => {
    const r1 = parse("```js\n");
    const r2 = parse("```js\nconst x = 1;\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThanOrEqual(1);
    const types = r2.tokens.map((t) => t.type);
    expect(types).toContain(TokenType.CodeBlock);
  });

  it("should accumulate content across multiple chunks", () => {
    let src = "```\n";
    let r = parse(src);
    for (const line of ["line 1\n", "line 2\n", "line 3\n"]) {
      src += line;
      r = parse(src, r.state);
    }
    const codeTokens = r.tokens.filter((t) => t.type === TokenType.CodeBlock);
    expect(codeTokens.length).toBeGreaterThanOrEqual(1);
  });

  it("should fall back when closing fence appears", () => {
    let src = "```\ncode\n";
    let r = parse(src);
    src += "```\n";
    r = parse(src, r.state);
    const codeTokens = r.tokens.filter((t) => t.type === TokenType.CodeBlock);
    expect(codeTokens.length).toBeGreaterThanOrEqual(1);
  });

  it("should match full parse for unclosed fenced code", () => {
    const src = "```js\nconst x = 1;\nconst y = 2;\n";
    const full = parse(src);

    let streaming = parse("```js\n");
    streaming = parse("```js\nconst x = 1;\n", streaming.state);
    streaming = parse(src, streaming.state);

    expect(streaming.tokens.length).toBe(full.tokens.length);
    const fullCode = full.tokens.find((t) => t.type === TokenType.CodeBlock);
    const streamCode = streaming.tokens.find((t) => t.type === TokenType.CodeBlock);
    expect(fullCode).toBeDefined();
    expect(streamCode).toBeDefined();
  });

  it("should preserve language info in fast path", () => {
    let src = "```typescript\n";
    let r = parse(src);
    src += "const x: number = 1;\n";
    r = parse(src, r.state);
    const code = r.tokens.find((t) => t.type === TokenType.CodeBlock) as
      | { lang: string }
      | undefined;
    expect(code?.lang).toBe("typescript");
  });
});

describe("parse -- math block continuation fast path", () => {
  it("should produce math block when appending lines inside $$", () => {
    const r1 = parse("$$\n", null, { math: true });
    const r2 = parse("$$\nx + y\n", r1.state);
    const types = r2.tokens.map((t) => t.type);
    expect(types).toContain(TokenType.MathBlock);
  });

  it("should accumulate content across multiple chunks", () => {
    let src = "$$\n";
    let r = parse(src, null, { math: true });
    for (const line of ["a + b\n", "c + d\n"]) {
      src += line;
      r = parse(src, r.state);
    }
    const mathTokens = r.tokens.filter((t) => t.type === TokenType.MathBlock);
    expect(mathTokens.length).toBeGreaterThanOrEqual(1);
  });

  it("should fall back when closing $$ appears", () => {
    let src = "$$\nx\n";
    let r = parse(src, null, { math: true });
    src += "$$\n";
    r = parse(src, r.state);
    const mathTokens = r.tokens.filter((t) => t.type === TokenType.MathBlock);
    expect(mathTokens.length).toBeGreaterThanOrEqual(1);
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

  it("should support streaming", () => {
    const p = createParser();
    const r1 = p("# Hello\n");
    const r2 = p("# Hello\nWorld\n", r1.state);
    expect(r2.tokens.length).toBeGreaterThan(0);
  });
});
