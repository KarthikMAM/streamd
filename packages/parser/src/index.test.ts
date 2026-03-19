import { describe, expect, it } from "vitest";
import { parse, TokenType } from "./index";

describe("parse", () => {
  it("should return empty tokens for empty input", () => {
    const { tokens } = parse("");
    expect(tokens).toEqual([]);
  });

  it("should parse a single ATX heading", () => {
    const { tokens } = parse("# Hello");
    expect(tokens.length).toBe(1);
    const heading = tokens[0];
    expect(heading).toBeDefined();
    expect(heading?.type).toBe(TokenType.Heading);
    if (heading?.type === TokenType.Heading) {
      expect(heading?.level).toBe(1);
      expect(heading?.children.length).toBe(1);
      expect(heading?.children[0]?.type).toBe(TokenType.Text);
    }
  });

  it("should parse heading levels 1-6", () => {
    for (let level = 1; level <= 6; level++) {
      const hashes = "#".repeat(level);
      const { tokens } = parse(`${hashes} Level ${level}`);
      expect(tokens.length).toBe(1);
      const heading = tokens[0];
      expect(heading?.type).toBe(TokenType.Heading);
      if (heading?.type === TokenType.Heading) {
        expect(heading?.level).toBe(level);
      }
    }
  });

  it("should not parse 7 hashes as a heading", () => {
    const { tokens } = parse("####### Not a heading");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.Paragraph);
  });

  it("should parse a paragraph", () => {
    const { tokens } = parse("Hello world");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.Paragraph);
  });

  it("should parse a thematic break", () => {
    const { tokens } = parse("---");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.Hr);
  });

  it("should parse multiple thematic break variants", () => {
    for (const hr of ["***", "---", "___", "* * *", "- - -", "_ _ _"]) {
      const { tokens } = parse(hr);
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.Hr);
    }
  });

  it("should parse a fenced code block", () => {
    const { tokens } = parse("```js\nconsole.log('hi')\n```");
    expect(tokens.length).toBe(1);
    const codeBlock = tokens[0];
    expect(codeBlock?.type).toBe(TokenType.CodeBlock);
    if (codeBlock?.type === TokenType.CodeBlock) {
      expect(codeBlock?.lang).toBe("js");
      expect(codeBlock?.content).toContain("console.log");
    }
  });

  it("should parse heading followed by paragraph", () => {
    const { tokens } = parse("# Title\n\nSome text");
    expect(tokens.length).toBe(2);
    expect(tokens[0]?.type).toBe(TokenType.Heading);
    expect(tokens[1]?.type).toBe(TokenType.Paragraph);
  });

  it("should return stableCount equal to token count for full parse", () => {
    const { tokens, stableCount } = parse("# Hello");
    expect(stableCount).toBe(tokens.length);
  });

  it("should return a state object", () => {
    const { state } = parse("# Hello");
    expect(state).toBeDefined();
  });

  describe("streaming", () => {
    it("should parse chunks incrementally", () => {
      const { state: s1 } = parse("# Hello\n", null);
      expect(s1).toBeDefined();

      const { tokens: t2, state: s2 } = parse("world\n", s1);
      expect(t2.length).toBeGreaterThan(0);

      const { tokens: t3 } = parse("", s2); // flush
      expect(t3.length).toBeGreaterThan(0);
    });
  });

  describe("inline parsing", () => {
    it("should parse emphasis *text*", () => {
      const { tokens } = parse("*hello*");
      expect(tokens.length).toBe(1);
      const para = tokens[0];
      expect(para?.type).toBe(TokenType.Paragraph);
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children.length).toBe(1);
        expect(para?.children[0]?.type).toBe(TokenType.Em);
      }
    });

    it("should parse strong emphasis **text**", () => {
      const { tokens } = parse("**bold**");
      expect(tokens.length).toBe(1);
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.Strong);
      }
    });

    it("should parse code span `code`", () => {
      const { tokens } = parse("`code`");
      expect(tokens.length).toBe(1);
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.CodeSpan);
        if (para?.children[0]?.type === TokenType.CodeSpan) {
          expect(para?.children[0]?.content).toBe("code");
        }
      }
    });

    it("should parse double backtick code span", () => {
      const { tokens } = parse("`` code with ` inside ``");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.CodeSpan);
        if (para?.children[0]?.type === TokenType.CodeSpan) {
          expect(para?.children[0]?.content).toBe("code with ` inside");
        }
      }
    });

    it("should parse backslash escapes", () => {
      const { tokens } = parse("\\*not emphasis\\*");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.Escape);
      }
    });

    it("should parse mixed inline content", () => {
      const { tokens } = parse("Hello *world* and `code`");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children.length).toBeGreaterThan(1);
      }
    });

    it("should parse named HTML entities as raw text", () => {
      const { tokens } = parse("&amp;");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        const first = para?.children[0];
        expect(first?.type).toBe(TokenType.Text);
        if (first?.type === TokenType.Text) {
          expect(first?.content).toBe("&amp;");
        }
      }
    });

    it("should parse numeric entities", () => {
      const { tokens } = parse("&#35; &#x23;");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        const first = para?.children[0];
        expect(first?.type).toBe(TokenType.Text);
        if (first?.type === TokenType.Text) {
          expect(first?.content).toBe("#");
        }
      }
    });

    it("should parse autolinks in angle brackets", () => {
      const { tokens } = parse("<http://example.com>");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.Link);
        if (para?.children[0]?.type === TokenType.Link) {
          expect(para?.children[0]?.href).toBe("http://example.com");
        }
      }
    });

    it("should parse inline HTML tags", () => {
      const { tokens } = parse("a <em>b</em> c");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        // Should contain HtmlInline tokens for <em> and </em>
        let hasHtml = false;
        for (const child of para.children) {
          if (child.type === TokenType.HtmlInline) {
            hasHtml = true;
            break;
          }
        }
        expect(hasHtml).toBe(true);
      }
    });

    it("should parse underscore emphasis correctly", () => {
      const { tokens } = parse("_hello_");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.Em);
      }
    });

    it("should handle nested emphasis *foo **bar** baz*", () => {
      const { tokens } = parse("*foo **bar** baz*");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.Em);
      }
    });
  });

  describe("links and images", () => {
    it("should parse inline link [text](url)", () => {
      const { tokens } = parse("[click](https://example.com)");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.Link);
        if (para?.children[0]?.type === TokenType.Link) {
          expect(para?.children[0]?.href).toBe("https://example.com");
        }
      }
    });

    it("should parse link with title", () => {
      const { tokens } = parse('[click](https://example.com "Title")');
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        const link = para?.children[0];
        if (link?.type === TokenType.Link) {
          expect(link?.href).toBe("https://example.com");
          expect(link?.title).toBe("Title");
        }
      }
    });

    it("should parse image ![alt](src)", () => {
      const { tokens } = parse("![logo](img.png)");
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.Image);
        if (para?.children[0]?.type === TokenType.Image) {
          expect(para?.children[0]?.src).toBe("img.png");
          expect(para?.children[0]?.alt).toBe("logo");
        }
      }
    });
  });

  describe("setext headings", () => {
    it("should parse = underline as level 1 heading", () => {
      const { tokens } = parse("Hello\n===");
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.Heading);
      if (tokens[0]?.type === TokenType.Heading) {
        expect(tokens[0]?.level).toBe(1);
      }
    });

    it("should parse - underline as level 2 heading", () => {
      const { tokens } = parse("Hello\n---");
      expect(tokens.length).toBe(1);
    });
  });

  describe("HTML blocks", () => {
    it("should parse a <div> as an HTML block", () => {
      const { tokens } = parse("<div>\nfoo\n</div>");
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.HtmlBlock);
    });

    it("should parse <!-- comment --> as HTML block type 2", () => {
      const { tokens } = parse("<!-- comment -->");
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.HtmlBlock);
    });
  });

  describe("ATX heading closing sequence", () => {
    it("should strip closing # sequence", () => {
      const { tokens } = parse("# Hello #");
      expect(tokens.length).toBe(1);
      if (tokens[0]?.type === TokenType.Heading) {
        expect(tokens[0]?.children.length).toBe(1);
        if (tokens[0]?.children[0]?.type === TokenType.Text) {
          expect(tokens[0]?.children[0]?.content).toBe("Hello");
        }
      }
    });

    it("should strip closing ## sequence", () => {
      const { tokens } = parse("## Hello ##");
      if (tokens[0]?.type === TokenType.Heading) {
        expect(tokens[0]?.level).toBe(2);
        if (tokens[0]?.children[0]?.type === TokenType.Text) {
          expect(tokens[0]?.children[0]?.content).toBe("Hello");
        }
      }
    });
  });

  describe("blockquotes", () => {
    it("should parse a simple blockquote", () => {
      const { tokens } = parse("> Hello");
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.Blockquote);
      if (tokens[0]?.type === TokenType.Blockquote) {
        expect(tokens[0]?.children.length).toBe(1);
      }
    });
  });

  describe("lists", () => {
    it("should parse a bullet list", () => {
      const { tokens } = parse("- one\n- two\n- three");
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.List);
      if (tokens[0]?.type === TokenType.List) {
        expect(tokens[0]?.ordered).toBe(false);
        expect(tokens[0]?.children.length).toBe(3);
      }
    });

    it("should parse an ordered list", () => {
      const { tokens } = parse("1. first\n2. second");
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.List);
      if (tokens[0]?.type === TokenType.List) {
        expect(tokens[0]?.ordered).toBe(true);
        expect(tokens[0]?.start).toBe(1);
      }
    });
  });

  describe("math", () => {
    it("should parse inline math $E=mc^2$ when math enabled", () => {
      const { tokens } = parse("$E=mc^2$", null, { math: true });
      expect(tokens.length).toBe(1);
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        expect(para?.children[0]?.type).toBe(TokenType.MathInline);
        if (para?.children[0]?.type === TokenType.MathInline) {
          expect(para?.children[0]?.content).toBe("E=mc^2");
        }
      }
    });

    it("should NOT parse inline math when math disabled", () => {
      const { tokens } = parse("$E=mc^2$");
      expect(tokens.length).toBe(1);
      const para = tokens[0];
      if (para?.type === TokenType.Paragraph) {
        // $ should just be text, no MathInline
        expect(para?.children[0]?.type).toBe(TokenType.Text);
      }
    });

    it("should parse block math $$...$$ when math enabled", () => {
      const { tokens } = parse("$$\nx^2 + y^2 = z^2\n$$", null, { math: true });
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.MathBlock);
      if (tokens[0]?.type === TokenType.MathBlock) {
        expect(tokens[0]?.content).toContain("x^2");
      }
    });

    it("should NOT parse block math when math disabled", () => {
      const { tokens } = parse("$$\nx^2\n$$");
      // Without math enabled, $$ is not recognized as a block math opener
      expect(tokens[0]?.type).not.toBe(TokenType.MathBlock);
    });
  });

  describe("code blocks", () => {
    it("should parse fenced code with tilde", () => {
      const { tokens } = parse("~~~\ncode\n~~~");
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.CodeBlock);
    });

    it("should preserve info string", () => {
      const { tokens } = parse("```typescript foo bar\ncode\n```");
      if (tokens[0]?.type === TokenType.CodeBlock) {
        expect(tokens[0]?.lang).toBe("typescript");
        expect(tokens[0]?.info).toBe("typescript foo bar");
      }
    });

    it("should handle unclosed fence at EOF", () => {
      const { tokens } = parse("```\ncode\nmore code");
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.CodeBlock);
    });

    it("should parse indented code block", () => {
      const { tokens } = parse("    code line 1\n    code line 2");
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe(TokenType.CodeBlock);
      if (tokens[0]?.type === TokenType.CodeBlock) {
        expect(tokens[0]?.lang).toBe("");
      }
    });
  });
});

describe("parse — coverage edge cases", () => {
  it("should handle fenced code with indent stripping", () => {
    const { tokens } = parse("  ```\n  code\n  ```");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.CodeBlock);
  });

  it("should handle indented code with trailing blank lines", () => {
    const { tokens } = parse("    code\n    \n    more\n\npara");
    expect(tokens.length).toBe(2);
    expect(tokens[0]?.type).toBe(TokenType.CodeBlock);
  });

  it("should handle HTML block type 2 (comment)", () => {
    const { tokens } = parse("<!-- comment -->");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.HtmlBlock);
  });

  it("should handle HTML block type 3 (processing instruction)", () => {
    const { tokens } = parse("<?xml version?>");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.HtmlBlock);
  });

  it("should handle HTML block type 5 (CDATA)", () => {
    const { tokens } = parse("<![CDATA[data]]>");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.HtmlBlock);
  });

  it("should handle HTML block type 7 (generic tag)", () => {
    const { tokens } = parse("<custom>\ncontent\n</custom>");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.HtmlBlock);
  });

  it("should handle table without leading pipe", () => {
    const { tokens } = parse("A | B\n---|---\n1 | 2", null, { gfm: true });
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.Table);
  });

  it("should handle CRLF line endings", () => {
    const { tokens } = parse("# Hello\r\n\r\nWorld");
    expect(tokens.length).toBe(2);
    expect(tokens[0]?.type).toBe(TokenType.Heading);
  });

  it("should handle inline HTML tags", () => {
    const { tokens } = parse("text <em>emphasis</em> text");
    expect(tokens.length).toBe(1);
  });

  it("should handle GFM autolinks", () => {
    const { tokens } = parse("Visit https://example.com today", null, { gfm: true });
    expect(tokens.length).toBe(1);
    if (tokens[0]?.type === TokenType.Paragraph) {
      const hasLink = tokens[0].children.some((c) => c.type === TokenType.Link);
      expect(hasLink).toBe(true);
    }
  });

  it("should handle deeply nested blockquotes", () => {
    const src = `${"> ".repeat(50)}deep`;
    const { tokens } = parse(src);
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.Blockquote);
  });

  it("should handle empty fenced code block", () => {
    const { tokens } = parse("```\n```");
    expect(tokens.length).toBe(1);
    if (tokens[0]?.type === TokenType.CodeBlock) {
      expect(tokens[0].content).toBe("");
    }
  });

  it("should handle unclosed fenced code at EOF", () => {
    const { tokens } = parse("```\ncode");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.CodeBlock);
  });

  it("should handle tilde fenced code", () => {
    const { tokens } = parse("~~~\ncode\n~~~");
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.CodeBlock);
  });

  it("should handle blockquote with blank line continuation", () => {
    const { tokens } = parse("> line 1\n\n> line 2");
    expect(tokens.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle ordered list with ) delimiter", () => {
    const { tokens } = parse("1) First\n2) Second");
    expect(tokens.length).toBe(1);
    if (tokens[0]?.type === TokenType.List) {
      expect(tokens[0].ordered).toBe(true);
    }
  });

  it("should handle backslash escape before newline as hard break", () => {
    const { tokens } = parse("line1\\\nline2");
    expect(tokens.length).toBe(1);
    if (tokens[0]?.type === TokenType.Paragraph) {
      const hasHardbreak = tokens[0].children.some((c) => c.type === TokenType.Hardbreak);
      expect(hasHardbreak).toBe(true);
    }
  });

  it("should handle entity references", () => {
    const { tokens } = parse("&amp; &#35; &#x23;");
    expect(tokens.length).toBe(1);
  });

  it("should handle image syntax", () => {
    const { tokens } = parse("![alt](src.png)");
    expect(tokens.length).toBe(1);
    if (tokens[0]?.type === TokenType.Paragraph) {
      expect(tokens[0].children[0]?.type).toBe(TokenType.Image);
    }
  });

  it("should handle math inline when enabled", () => {
    const { tokens } = parse("$x^2$", null, { math: true });
    expect(tokens.length).toBe(1);
    if (tokens[0]?.type === TokenType.Paragraph) {
      expect(tokens[0].children[0]?.type).toBe(TokenType.MathInline);
    }
  });
});

describe("parse — nesting depth protection", () => {
  it("should handle deeply nested blockquotes without crashing", () => {
    const src = `${"> ".repeat(150)}deep`;
    const { tokens } = parse(src);
    expect(tokens.length).toBe(1);
    expect(tokens[0]?.type).toBe(TokenType.Blockquote);
  });
});
