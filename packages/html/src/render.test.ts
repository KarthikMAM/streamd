/**
 * Unit tests for @streamd/html renderer.
 *
 * Covers every token type produced by @streamd/parser (schema 2) and the
 * rendering-option surface (xhtml, classPrefix, taskListCheckboxes, math,
 * components).
 *
 * @module render.test
 */

import type { HighlightData } from "@streamd/parser";
import { parse, type Token, TokenType } from "@streamd/parser";
import { describe, expect, it } from "vitest";
import { renderHtml } from "./render";
import type { HtmlRenderContext } from "./types";
import { StreamdHtmlArgumentError } from "./validation";

/** Shorthand: parse markdown and render to HTML. */
const run = (src: string, opts?: Parameters<typeof parse>[2]): string =>
  renderHtml(parse(src, null, opts).tokens);

describe("renderHtml — block tokens", () => {
  it("heading 1-6", () => {
    expect(run("# h1")).toBe("<h1>h1</h1>\n");
    expect(run("###### h6")).toBe("<h6>h6</h6>\n");
  });

  it("paragraph with newline in text (softbreak collapsed into text)", () => {
    const html = run("line one\nline two\n");
    expect(html).toContain("line one");
    expect(html).toContain("line two");
    expect(html).toMatch(/^<p>[\s\S]*<\/p>\n$/);
  });

  it("paragraph with hardbreak (two trailing spaces)", () => {
    expect(run("line one  \nline two\n")).toBe("<p>line one<br />\nline two</p>\n");
  });

  it("blockquote wraps children", () => {
    expect(run("> quoted\n")).toBe("<blockquote>\n<p>quoted</p>\n</blockquote>\n");
  });

  it("thematic break", () => {
    expect(run("---\n")).toBe("<hr />\n");
  });

  it("fenced code with language class", () => {
    const out = run("```js\nlet x=1;\n```\n");
    expect(out).toContain('<code class="language-js">let x=1;\n</code></pre>');
    expect(out).toContain("<pre");
  });

  it("indented code", () => {
    const out = run("    let x=1;\n");
    expect(out).toContain("<code>let x=1;\n</code></pre>");
    expect(out).toContain("<pre");
  });

  it("tight unordered list", () => {
    expect(run("- a\n- b\n")).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n");
  });

  it("wraps paragraphs in loose lists", () => {
    const md = "- a\n\n- b\n";
    const html = run(md);
    expect(html).toMatch(/<li>\s*<p>a<\/p>\s*<\/li>/);
    expect(html).toMatch(/<li>\s*<p>b<\/p>\s*<\/li>/);
  });

  it("ordered list with start attribute", () => {
    expect(run("5. a\n6. b\n")).toBe('<ol start="5">\n<li>a</li>\n<li>b</li>\n</ol>\n');
  });
});

describe("renderHtml — inline tokens", () => {
  it("emphasis and strong", () => {
    expect(run("*em* **st**\n")).toBe("<p><em>em</em> <strong>st</strong></p>\n");
  });

  it("code span", () => {
    expect(run("use `code` here\n")).toBe("<p>use <code>code</code> here</p>\n");
  });

  it("link with title", () => {
    expect(run('[name](/url "t")\n')).toBe('<p><a href="/url" title="t">name</a></p>\n');
  });

  it("image", () => {
    expect(run('![alt](/u "t")\n')).toBe('<p><img src="/u" alt="alt" title="t" /></p>\n');
  });

  it("backslash escape", () => {
    expect(run("\\*not em\\*\n")).toBe("<p>*not em*</p>\n");
  });

  it("named entity decoded in text", () => {
    expect(run("&nbsp;foo\n")).toBe("<p>\u00a0foo</p>\n");
  });

  it("numeric entity decoded in text", () => {
    expect(run("&#65;&#x42;\n")).toBe("<p>AB</p>\n");
  });

  it("escapes ampersand in plain text", () => {
    expect(run("a & b\n")).toBe("<p>a &amp; b</p>\n");
  });
});

describe("renderHtml — GFM extensions", () => {
  it("strikethrough", () => {
    expect(run("~~gone~~\n", { gfm: true })).toBe("<p><del>gone</del></p>\n");
  });

  it("task list", () => {
    const out = run("- [x] done\n- [ ] open\n", { gfm: true });
    expect(out).toContain('checked="" disabled="" type="checkbox"');
    expect(out).toMatch(/<li><input [^>]*type="checkbox"[^>]*\/> open<\/li>/);
  });

  it("table with alignment", () => {
    const md = "| a | b |\n| :-- | --: |\n| 1 | 2 |\n";
    const html = run(md, { gfm: true });
    expect(html).toMatch(/<th[^>]*align="left"[^>]*>a<\/th>/);
    expect(html).toMatch(/<th[^>]*align="right"[^>]*>b<\/th>/);
    expect(html).toContain('<td align="left">1</td>');
  });
});

describe("renderHtml — math", () => {
  it("inline math as span-class by default", () => {
    const md = "see $e=mc^2$ here\n";
    const html = renderHtml(parse(md, null, { math: true }).tokens);
    expect(html).toContain('<code class="language-math math-inline">e=mc^2</code>');
  });

  it("math block as pre-code by default", () => {
    const md = "$$\nE=mc^2\n$$\n";
    const html = renderHtml(parse(md, null, { math: true }).tokens);
    expect(html).toContain('class="language-math math-display"');
    expect(html).toContain("E=mc^2");
  });

  it("math=none omits math content", () => {
    const md = "use $e=mc^2$ x\n";
    const html = renderHtml(parse(md, null, { math: true }).tokens, { math: "none" });
    expect(html).toBe("<p>use  x</p>\n");
  });

  it("math=tex-delim restores inline delimiters", () => {
    const md = "value $x$ here\n";
    const html = renderHtml(parse(md, null, { math: true }).tokens, { math: "tex-delim" });
    expect(html).toContain("$x$");
  });

  it("math=tex-delim restores block-math delimiters", () => {
    const md = "$$\nE=mc^2\n$$\n";
    const html = renderHtml(parse(md, null, { math: true }).tokens, { math: "tex-delim" });
    expect(html).toContain("$$\nE=mc^2$$\n");
  });
});

describe("renderHtml — options", () => {
  it("xhtml=false emits HTML5 void tags", () => {
    const html = renderHtml(parse("---\n").tokens, { xhtml: false });
    expect(html).toBe("<hr>\n");
  });

  it("classPrefix annotates block tags", () => {
    const html = renderHtml(parse("# a\n\nb\n").tokens, { classPrefix: "md" });
    expect(html).toContain('<h1 class="md-h1">a</h1>');
    expect(html).toContain('<p class="md-p">b</p>');
  });

  it("wrapRoot wraps output in a div when classPrefix provided", () => {
    const html = renderHtml(parse("hi\n").tokens, { classPrefix: "md", wrapRoot: true });
    expect(html.startsWith('<div class="md-root">\n')).toBe(true);
    expect(html.trimEnd().endsWith("</div>")).toBe(true);
  });

  it("wrapRoot still wraps output in a div when token list is empty", () => {
    const html = renderHtml([], { classPrefix: "md", wrapRoot: true });
    expect(html).toBe('<div class="md-root">\n</div>\n');
  });

  it("omitCodeLanguageClass drops the language attribute", () => {
    const html = renderHtml(parse("```js\nx\n```\n").tokens, { omitCodeLanguageClass: true });
    expect(html).not.toContain("language-");
    expect(html).toContain("<code>x\n</code></pre>");
  });

  it("taskListCheckboxes=none emits plain text", () => {
    const html = renderHtml(parse("- [x] done\n", null, { gfm: true }).tokens, {
      taskListCheckboxes: "none",
    });
    expect(html).toContain("[x] done");
    expect(html).not.toContain("<input");
  });

  it("loose list with nested list forces full-paragraph rendering", () => {
    const tokens = [
      {
        type: TokenType.List,
        ordered: false,
        start: 1,
        tight: false,
        children: [
          {
            type: TokenType.ListItem,
            checked: null,
            children: [
              {
                type: TokenType.Paragraph,
                children: [{ type: TokenType.Text, content: "outer" }],
              },
              {
                type: TokenType.List,
                ordered: false,
                start: 1,
                tight: true,
                children: [
                  {
                    type: TokenType.ListItem,
                    checked: null,
                    children: [
                      {
                        type: TokenType.Paragraph,
                        children: [{ type: TokenType.Text, content: "nested" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const html = renderHtml(tokens as unknown as Parameters<typeof renderHtml>[0]);
    expect(html).toContain("<p>outer</p>");
    expect(html).toContain("<li>nested</li>");
  });
});

describe("renderHtml — component overrides", () => {
  it("invokes a code_block override and splices its return value", () => {
    const tokens = [
      { type: TokenType.CodeBlock, lang: "js", content: "x=1", meta: undefined },
    ] as unknown as Parameters<typeof renderHtml>[0];
    const html = renderHtml(tokens, {
      components: { code_block: (t) => `<custom>${t.content}</custom>` },
    });
    expect(html).toBe("<custom>x=1</custom>");
  });

  it("override receives a working ctx.render callback for delegation", () => {
    const tokens = parse("# hello\n").tokens;
    const html = renderHtml(tokens, {
      components: {
        heading: (_t, ctx: HtmlRenderContext) => {
          const inner = ctx.render({
            type: TokenType.Paragraph,
            children: [{ type: TokenType.Text, content: "delegated" }],
          } as Token);
          return `<div>${inner}</div>`;
        },
      },
    });
    expect(html).toBe("<div><p>delegated</p>\n</div>");
  });

  it("override receives ctx.escapeHtml and ctx.classPrefix", () => {
    const tokens = [
      { type: TokenType.CodeBlock, lang: "ts", content: "<b>hi</b>", meta: undefined },
    ] as unknown as Parameters<typeof renderHtml>[0];
    const html = renderHtml(tokens, {
      classPrefix: "md",
      components: {
        code_block: (t, ctx) =>
          `<pre class="${ctx.classPrefix}">${ctx.escapeHtml(t.content)}</pre>`,
      },
    });
    expect(html).toBe('<pre class="md">&lt;b&gt;hi&lt;/b&gt;</pre>');
  });

  it("inline override is invoked for text tokens", () => {
    const tokens = parse("hello\n").tokens;
    const html = renderHtml(tokens, {
      components: { text: (t) => t.content.toUpperCase() },
    });
    expect(html).toContain("HELLO");
  });
});

describe("renderHtml — meta.highlight code block", () => {
  it("renders per-segment spans with inline styles when highlight is populated", () => {
    const highlight: HighlightData = {
      lang: "js",
      theme: "light",
      lines: [
        [
          { text: "const", color: "#0000ff", bold: true },
          { text: " x = ", color: "#000000" },
          { text: "1", color: "#098658" },
        ],
      ],
    };
    const tokens = [
      { type: TokenType.CodeBlock, lang: "js", content: "const x = 1", meta: { highlight } },
    ] as unknown as Parameters<typeof renderHtml>[0];
    const html = renderHtml(tokens);
    expect(html).toContain('class="streamd-code-block"');
    expect(html).toContain('data-lang="js"');
    expect(html).toContain('role="region"');
    expect(html).toContain('<span style="color:#0000ff;font-weight:bold">const</span>');
    expect(html).toContain('<span style="color:#000000"> x = </span>');
    expect(html).toContain('<span style="color:#098658">1</span>');
  });

  it("renders multi-line highlight with newlines between lines", () => {
    const highlight: HighlightData = {
      lang: "ts",
      theme: "dark",
      lines: [[{ text: "line1" }], [{ text: "line2", italic: true }]],
    };
    const tokens = [
      { type: TokenType.CodeBlock, lang: "ts", content: "line1\nline2", meta: { highlight } },
    ] as unknown as Parameters<typeof renderHtml>[0];
    const html = renderHtml(tokens);
    expect(html).toContain("line1\n");
    expect(html).toContain('<span style="font-style:italic">line2</span>');
  });

  it("renders unstyled segments as plain escaped text (no span)", () => {
    const highlight: HighlightData = {
      lang: "txt",
      theme: "light",
      lines: [[{ text: "<b>raw</b>" }]],
    };
    const tokens = [
      { type: TokenType.CodeBlock, lang: "txt", content: "<b>raw</b>", meta: { highlight } },
    ] as unknown as Parameters<typeof renderHtml>[0];
    const html = renderHtml(tokens);
    expect(html).toContain("&lt;b&gt;raw&lt;/b&gt;");
    expect(html).not.toContain("<span");
  });

  it("falls back to plain code when meta.highlight is absent", () => {
    const tokens = [
      { type: TokenType.CodeBlock, lang: "js", content: "x=1", meta: undefined },
    ] as unknown as Parameters<typeof renderHtml>[0];
    const html = renderHtml(tokens);
    expect(html).toContain('<code class="language-js">x=1</code></pre>');
    expect(html).not.toContain("streamd-code-block");
  });

  it("escapes segment text to prevent XSS", () => {
    const highlight: HighlightData = {
      lang: "html",
      theme: "light",
      lines: [[{ text: "<script>alert(1)</script>", color: "#f00" }]],
    };
    const tokens = [
      { type: TokenType.CodeBlock, lang: "html", content: "", meta: { highlight } },
    ] as unknown as Parameters<typeof renderHtml>[0];
    const html = renderHtml(tokens);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderHtml — edge cases", () => {
  it("empty token list yields empty string", () => {
    expect(renderHtml([])).toBe("");
  });

  it("throws on an unknown token kind", () => {
    const garbage = [{ type: "unknown_garbage" as unknown, children: [] as Array<never> }];
    expect(() => renderHtml(garbage as unknown as Array<never>)).toThrow(StreamdHtmlArgumentError);
    expect(() => renderHtml(garbage as unknown as Array<never>)).toThrow(/unknown token type/);
  });

  it("malformed block token surfaces as StreamdHtmlArgumentError with correct kind", () => {
    const garbage = [{ type: "unknown_garbage" as unknown, children: [] as Array<never> }];
    expect(() => renderHtml(garbage as unknown as Array<never>)).toThrow(
      expect.objectContaining({
        kind: "unknown-token-type",
        source: "@streamd/html",
        caller: "renderBlock",
      }),
    );
  });

  it("link href with space gets percent-encoded in angle-bracket form", () => {
    const html = run("[a](<foo bar>)\n");
    expect(html).toContain('href="foo%20bar"');
  });

  it("image alt with ampersand is escaped", () => {
    const html = run("![a&b](/u)\n");
    expect(html).toContain('alt="a&amp;b"');
  });
});
