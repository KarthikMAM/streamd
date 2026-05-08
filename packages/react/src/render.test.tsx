/**
 * Unit tests for @streamd/react renderer.
 *
 * Uses react-dom/server.renderToStaticMarkup so tests run in Node without JSDOM.
 *
 * @module render.test
 */
import { parse, type Token, type TokensList, TokenType } from "@streamd/parser";
import { type ComponentType, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StreamdMarkdown } from "./markdown";
import { renderReact } from "./render";
import type { BaseProps, CodeBlockProps, HeadingProps, LinkProps } from "./types";
import { StreamdReactArgumentError } from "./validation";

const renderMarkdown = (src: string, gfm: boolean = false): string => {
  const tokens = parse(src, null, { gfm }).tokens;
  return renderToStaticMarkup(createElement("div", null, renderReact(tokens)) as ReactNode);
};

describe("renderReact — block tokens", () => {
  it("heading", () => {
    expect(renderMarkdown("# hello")).toContain('<h1 class="streamd-h1">hello</h1>');
  });

  it("paragraph", () => {
    expect(renderMarkdown("body text\n")).toContain('<p class="streamd-p">body text</p>');
  });

  it("blockquote wraps children", () => {
    const html = renderMarkdown("> quoted\n");
    expect(html).toContain('<blockquote class="streamd-blockquote">');
    expect(html).toContain('<p class="streamd-p">quoted</p>');
  });

  it("horizontal rule", () => {
    expect(renderMarkdown("---\n")).toContain('<hr class="streamd-hr"');
  });

  it("fenced code with language", () => {
    const html = renderMarkdown("```js\nlet x=1;\n```\n");
    expect(html).toMatch(/<pre[^>]*class="streamd-pre"[^>]*><code class="language-js">/);
    expect(html).toContain("let x=1;");
  });

  it("tight unordered list", () => {
    const html = renderMarkdown("- a\n- b\n");
    expect(html).toContain('<ul class="streamd-ul">');
    expect(html).toMatch(/<li class="streamd-li">\s*a\s*<\/li>/);
  });

  it("ordered list with start", () => {
    const html = renderMarkdown("5. a\n");
    expect(html).toContain('start="5"');
  });

  it("html block rendered as dangerouslySetInnerHTML div", () => {
    const html = renderMarkdown("<p>raw</p>\n");
    expect(html).toContain('class="streamd-html-block"');
    expect(html).toContain("<p>raw</p>");
  });
});

describe("renderReact — inline tokens", () => {
  it("strong + em", () => {
    expect(renderMarkdown("**bold** and *em*")).toContain(
      '<strong class="streamd-strong">bold</strong>',
    );
    expect(renderMarkdown("**bold** and *em*")).toContain('<em class="streamd-em">em</em>');
  });

  it("code span", () => {
    expect(renderMarkdown("a `code` b")).toContain('<code class="streamd-code">code</code>');
  });

  it("link renders with href and title", () => {
    const html = renderMarkdown('[x](/u "t")');
    expect(html).toContain('href="/u"');
    expect(html).toContain('title="t"');
  });

  it("image renders as img with alt", () => {
    const html = renderMarkdown("![alt](/i)");
    expect(html).toContain('alt="alt"');
    expect(html).toContain('src="/i"');
  });

  it("softbreak becomes newline", () => {
    const html = renderMarkdown("a\nb\n");
    expect(html).toContain("a\nb");
  });

  it("hardbreak renders <br>", () => {
    const html = renderMarkdown("a  \nb\n");
    expect(html).toContain('<br class="streamd-br"');
  });

  it("inline HTML is wrapped in a streamd-html-inline span with the raw tag preserved", () => {
    // Covers renderHtmlInline — emits the raw HTML via
    // dangerouslySetInnerHTML inside a marker span, so the data-x
    // attribute survives into the DOM.
    const html = renderMarkdown("a <span data-x>b</span> c");
    expect(html).toContain('class="streamd-html-inline"');
    expect(html).toContain("<span data-x>");
    expect(html).toContain(">b");
    expect(html).toContain(">a ");
    expect(html).toContain(" c</p>");
  });

  it("backslash escape renders the escaped character without the backslash", () => {
    // Covers renderEscape — the `\\*` in source becomes literal `*`
    // in the rendered paragraph (no em, no backslash).
    const html = renderMarkdown("\\*not em\\*");
    expect(html).toContain('<p class="streamd-p">*not em*</p>');
    expect(html).not.toContain("\\*");
    expect(html).not.toContain("<em");
  });
});

describe("renderReact — empty/edge cases extra", () => {
  it("tight list with a non-paragraph child renders via the loose path", () => {
    // Covers the `allParagraphs === false` branch in renderListItem's
    // tight-children rendering — the list item contains a nested List
    // so the shortcut fails and full-paragraph rendering is used.
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact([
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
          } as unknown as Token,
        ]) as ReactNode,
      ),
    );
    expect(html).toContain(">outer<");
    expect(html).toContain(">nested<");
  });
});

describe("renderReact — GFM", () => {
  it("strikethrough", () => {
    expect(renderMarkdown("~~gone~~", true)).toContain('<del class="streamd-del">gone</del>');
  });

  it("task list checkbox", () => {
    const html = renderMarkdown("- [x] done\n", true);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("table with alignment", () => {
    const html = renderMarkdown("| a | b |\n| :-- | --: |\n| 1 | 2 |\n", true);
    expect(html).toContain("<table");
    expect(html).toContain('align="left"');
    expect(html).toContain('align="right"');
  });
});

describe("renderReact — custom components", () => {
  it("heading override receives level prop", () => {
    const MyHeading = (props: HeadingProps): ReactNode =>
      createElement(`h${props.level}`, { "data-my": true }, props.children);
    const tokens = parse("## two\n").tokens;
    const out = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(tokens, { components: { heading: MyHeading as ComponentType<HeadingProps> } }),
      ) as ReactNode,
    );
    expect(out).toContain('<h2 data-my="true">two</h2>');
  });

  it("link override receives href and title", () => {
    const MyLink = (props: LinkProps): ReactNode =>
      createElement("a", { href: props.href, "data-custom": props.title }, props.children);
    const tokens = parse('[x](/u "t")').tokens;
    const out = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(tokens, { components: { link: MyLink as ComponentType<LinkProps> } }),
      ) as ReactNode,
    );
    expect(out).toContain('<a href="/u" data-custom="t">x</a>');
  });

  it("paragraph override wraps children", () => {
    const Wrap = (props: BaseProps): ReactNode =>
      createElement("section", { "data-wrap": true }, props.children);
    const tokens = parse("hello").tokens;
    const out = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(tokens, { components: { paragraph: Wrap as ComponentType<BaseProps> } }),
      ) as ReactNode,
    );
    expect(out).toContain('<section data-wrap="true">hello</section>');
  });
});

describe("StreamdMarkdown — top-level component", () => {
  it("renders from source prop", () => {
    const html = renderToStaticMarkup(createElement(StreamdMarkdown, { source: "# hi" }));
    expect(html).toContain('class="streamd-root"');
    expect(html).toContain('<h1 class="streamd-h1">hi</h1>');
  });

  it("renders from pre-parsed tokens", () => {
    const tokens = parse("# hi").tokens;
    const html = renderToStaticMarkup(createElement(StreamdMarkdown, { tokens }));
    expect(html).toContain('<h1 class="streamd-h1">hi</h1>');
  });

  it("applies custom classPrefix", () => {
    const html = renderToStaticMarkup(
      createElement(StreamdMarkdown, { source: "# hi", classPrefix: "md" }),
    );
    expect(html).toContain('class="md-root"');
    expect(html).toContain('<h1 class="md-h1">hi</h1>');
  });

  it("respects parseOptions.gfm", () => {
    const html = renderToStaticMarkup(
      createElement(StreamdMarkdown, {
        source: "~~gone~~",
        parseOptions: { gfm: true },
      }),
    );
    expect(html).toContain("<del");
  });
});

describe("renderReact — edge cases", () => {
  it("empty tokens yields null", () => {
    expect(renderReact([])).toBeNull();
  });

  it("math=none omits math tokens", () => {
    const tokens = parse("use $x$ here", null, { math: true }).tokens;
    const html = renderToStaticMarkup(
      createElement("div", null, renderReact(tokens, { math: "none" })) as ReactNode,
    );
    expect(html).toContain("use");
    expect(html).not.toContain("language-math");
  });
});

describe("renderReact — entity decoding (HTML parity)", () => {
  /**
   * The parser leaves named entities inside Text tokens literal — `&amp;`
   * in source becomes a Text token whose content is the 5 characters
   * `&amp;`. JSX auto-escapes the ampersand on every embedded string, so
   * without an explicit decode the output would be `&amp;amp;`. The HTML
   * renderer runs `escapeHtml(decodeEntities(content))` and emits a
   * single `&amp;`; the React renderer must match.
   */
  it("Text token with literal '&amp;' renders to a single '&' in text content", () => {
    const token: Token = { type: TokenType.Text, content: "&amp;" } as Token;
    const paragraph: Token = { type: TokenType.Paragraph, children: [token] } as Token;
    const html = renderToStaticMarkup(
      createElement("div", null, renderReact([paragraph] as TokensList)) as ReactNode,
    );
    // Serialized output must have the ampersand re-escaped exactly once.
    expect(html).toContain('<p class="streamd-p">&amp;</p>');
    expect(html).not.toContain("&amp;amp;");
  });

  it("Text token with named entity '&copy;' renders to '©' (then auto-escaped to itself)", () => {
    const token: Token = { type: TokenType.Text, content: "&copy;" } as Token;
    const paragraph: Token = { type: TokenType.Paragraph, children: [token] } as Token;
    const html = renderToStaticMarkup(
      createElement("div", null, renderReact([paragraph] as TokensList)) as ReactNode,
    );
    // © has no special-HTML meaning, JSX emits the raw Unicode char.
    expect(html).toContain('<p class="streamd-p">©</p>');
  });

  it("Text token with numeric entity '&#65;' renders to 'A'", () => {
    const token: Token = { type: TokenType.Text, content: "&#65;" } as Token;
    const paragraph: Token = { type: TokenType.Paragraph, children: [token] } as Token;
    const html = renderToStaticMarkup(
      createElement("div", null, renderReact([paragraph] as TokensList)) as ReactNode,
    );
    expect(html).toContain('<p class="streamd-p">A</p>');
  });

  it("Text token with hex entity '&#x41;' renders to 'A'", () => {
    const token: Token = { type: TokenType.Text, content: "&#x41;" } as Token;
    const paragraph: Token = { type: TokenType.Paragraph, children: [token] } as Token;
    const html = renderToStaticMarkup(
      createElement("div", null, renderReact([paragraph] as TokensList)) as ReactNode,
    );
    expect(html).toContain('<p class="streamd-p">A</p>');
  });

  it("Text token with malformed entity reference passes through unchanged", () => {
    const token: Token = { type: TokenType.Text, content: "A & B" } as Token;
    const paragraph: Token = { type: TokenType.Paragraph, children: [token] } as Token;
    const html = renderToStaticMarkup(
      createElement("div", null, renderReact([paragraph] as TokensList)) as ReactNode,
    );
    // Bare '&' becomes '&amp;' via JSX auto-escape — exactly one time.
    expect(html).toContain('<p class="streamd-p">A &amp; B</p>');
    expect(html).not.toContain("&amp;amp;");
  });

  it("matches the HTML renderer's output end-to-end for entity-encoded text", () => {
    const source = "plain &amp; and &copy; and &#65; and &#x41; end\n";
    const html = renderMarkdown(source);
    // Every entity is fully decoded in the DOM view (via single auto-escape).
    expect(html).toContain("plain &amp; and © and A and A end");
    expect(html).not.toContain("&amp;amp;");
  });
});

describe("renderReact — argument validation (H4 + H16)", () => {
  it("throws StreamdReactArgumentError for unknown token types (kind=unknown-token-type)", () => {
    const bogus: Token = { type: 999 as unknown as typeof TokenType.Text, content: "x" } as Token;
    expect(() => renderReact([bogus] as TokensList)).toThrow(StreamdReactArgumentError);
    expect(() => renderReact([bogus] as TokensList)).toThrow(
      expect.objectContaining({
        kind: "unknown-token-type",
        caller: "renderBlock",
        source: "@streamd/react",
      }),
    );
  });

  it("throws StreamdReactArgumentError when tokens is not an array (kind=tokens-not-array)", () => {
    expect(() => renderReact(null as unknown as TokensList)).toThrow(StreamdReactArgumentError);
    expect(() => renderReact(null as unknown as TokensList)).toThrow(
      expect.objectContaining({ kind: "tokens-not-array" }),
    );
  });

  it("StreamdMarkdown throws StreamdReactArgumentError when neither source nor tokens supplied", () => {
    expect(() => renderToStaticMarkup(createElement(StreamdMarkdown, {}))).toThrow(
      StreamdReactArgumentError,
    );
    expect(() => renderToStaticMarkup(createElement(StreamdMarkdown, {}))).toThrow(
      expect.objectContaining({ kind: "missing-input" }),
    );
  });
});

describe("renderReact — C1 allowDangerousMetaHtml gate", () => {
  const pluginInjectedHtml = "<pre><code><span class='hl'>let x=1;</span></code></pre>";

  const buildCodeBlockTokens = (): TokensList => [
    {
      type: TokenType.CodeBlock,
      lang: "js",
      info: "js",
      content: "let x=1;",
      meta: { html: pluginInjectedHtml },
    } as Token,
  ];

  it("ignores plugin meta.html by default (safe fallback)", () => {
    const tokens = buildCodeBlockTokens();
    const html = renderToStaticMarkup(createElement("div", null, renderReact(tokens)) as ReactNode);
    expect(html).toMatch(
      /<pre[^>]*class="streamd-pre"[^>]*><code class="language-js">let x=1;<\/code>/,
    );
    expect(html).not.toContain("class='hl'");
  });

  it("ignores plugin meta.html when allowDangerousMetaHtml is explicitly false", () => {
    const tokens = buildCodeBlockTokens();
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(tokens, { allowDangerousMetaHtml: false }),
      ) as ReactNode,
    );
    expect(html).not.toContain("class='hl'");
  });

  it("paints plugin meta.html when allowDangerousMetaHtml is true", () => {
    const tokens = buildCodeBlockTokens();
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(tokens, { allowDangerousMetaHtml: true }),
      ) as ReactNode,
    );
    expect(html).toContain("class='hl'");
  });

  it("custom CodeBlock override still receives allowDangerousMetaHtml flag", () => {
    const tokens = buildCodeBlockTokens();
    let capturedFlag: boolean | undefined;
    const CaptureCodeBlock = (props: CodeBlockProps): ReactNode => {
      capturedFlag = props.allowDangerousMetaHtml;
      return createElement("code", null, props.content);
    };
    renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(tokens, {
          allowDangerousMetaHtml: true,
          components: { codeBlock: CaptureCodeBlock as ComponentType<CodeBlockProps> },
        }),
      ) as ReactNode,
    );
    expect(capturedFlag).toBe(true);
  });

  it("passes flag through StreamdMarkdown top-level component", () => {
    // CodeBlock token wrapped in tokens so no parser involvement.
    const html = renderToStaticMarkup(
      createElement(StreamdMarkdown, {
        tokens: buildCodeBlockTokens(),
        allowDangerousMetaHtml: true,
      }),
    );
    expect(html).toContain("class='hl'");
  });
});

describe("StreamdMarkdown — parseOptions reactivity (H12)", () => {
  it("respects latest parseOptions on each render", () => {
    // Parent re-renders with toggled gfm — output reflects the new options.
    const withoutGfm = renderToStaticMarkup(
      createElement(StreamdMarkdown, {
        source: "~~gone~~",
        parseOptions: { gfm: false },
      }),
    );
    const withGfm = renderToStaticMarkup(
      createElement(StreamdMarkdown, {
        source: "~~gone~~",
        parseOptions: { gfm: true },
      }),
    );
    expect(withoutGfm).not.toContain("<del");
    expect(withGfm).toContain("<del");
  });
});
