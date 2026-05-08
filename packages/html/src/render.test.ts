/**
 * Unit tests for @streamd/html renderer.
 *
 * Covers every token type produced by @streamd/parser and the
 * rendering-option surface (xhtml, classPrefix, taskListCheckboxes, math).
 *
 * @module render.test
 */

import { parse, TokenType } from "@streamd/parser";
import { describe, expect, it } from "vitest";
import { renderHtml } from "./render";
import { StreamdHtmlArgumentError } from "./validation";

const run = (src: string, opts?: Parameters<typeof parse>[2]): string =>
  renderHtml(parse(src, null, opts).tokens);

describe("renderHtml — block tokens", () => {
  it("heading 1-6", () => {
    expect(run("# h1")).toBe("<h1>h1</h1>\n");
    expect(run("###### h6")).toBe("<h6>h6</h6>\n");
  });

  it("paragraph with softbreak", () => {
    expect(run("line one\nline two\n")).toBe("<p>line one\nline two</p>\n");
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
    // Blank line between items → loose list → each item-paragraph keeps its <p> wrapper.
    // CommonMark §5.2.
    const md = "- a\n\n- b\n";
    const tokens = parse(md).tokens;
    const html = renderHtml(tokens);
    expect(html).toMatch(/<li>\s*<p>a<\/p>\s*<\/li>/);
    expect(html).toMatch(/<li>\s*<p>b<\/p>\s*<\/li>/);
  });

  it("ordered list with start attribute", () => {
    expect(run("5. a\n6. b\n")).toBe('<ol start="5">\n<li>a</li>\n<li>b</li>\n</ol>\n');
  });

  it("html block passes through", () => {
    const out = run("<div>raw</div>\n");
    expect(out).toContain("<div>raw</div>");
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

  it("inline html", () => {
    expect(run("use <span>x</span>\n")).toBe("<p>use <span>x</span></p>\n");
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
    // Covers the `effective.length === 0 && wrapRoot` branch — the renderer
    // emits an open+close root wrapper so the caller's mount target
    // doesn't see a stale DOM tree on first render.
    const html = renderHtml([], { classPrefix: "md", wrapRoot: true });
    expect(html).toBe('<div class="md-root">\n</div>\n');
  });

  it("math=tex-delim restores block-math delimiters", () => {
    // Covers the block-math tex-delim branch that sits alongside the
    // inline-math case tested above.
    const md = "$$\nE=mc^2\n$$\n";
    const html = renderHtml(parse(md, null, { math: true }).tokens, { math: "tex-delim" });
    expect(html).toContain("$$\nE=mc^2$$\n");
  });

  it("loose list with a nested list as a child forces full-paragraph rendering", () => {
    // Covers `tryRenderTightChildren` returning false for a list item
    // whose children include a non-Paragraph token. Constructed as a
    // token tree directly — parser output doesn't naturally produce this
    // shape for short fixtures.
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
              // Non-Paragraph child forces the full-paragraph rendering path.
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
});

describe("renderHtml — edge cases", () => {
  it("empty token list yields empty string", () => {
    expect(renderHtml([])).toBe("");
  });

  it("throws on an unknown token kind", () => {
    const garbage = [{ type: 999 as unknown as 0, children: [] as Array<never> }];
    expect(() => renderHtml(garbage as unknown as Array<never>)).toThrow(StreamdHtmlArgumentError);
    expect(() => renderHtml(garbage as unknown as Array<never>)).toThrow(/unknown token type 999/);
  });

  it("malformed block token surfaces as StreamdHtmlArgumentError with correct kind", () => {
    const garbage = [{ type: 999 as unknown as 0, children: [] as Array<never> }];
    expect(() => renderHtml(garbage as unknown as Array<never>)).toThrow(StreamdHtmlArgumentError);
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
