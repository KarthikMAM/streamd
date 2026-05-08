/**
 * Unit tests for @streamd/react renderer.
 *
 * Uses react-dom/server.renderToStaticMarkup so tests run in Node without JSDOM.
 *
 * @module render.test
 */
import { parse, type Token, type TokensList } from "@streamd/parser";
import { type ComponentType, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StreamdMarkdown } from "./markdown";
import { renderReact } from "./render";
import type { ReactComponents } from "./types";
import { StreamdReactArgumentError } from "./validation";

/**
 * Renders markdown source to static HTML via the React renderer.
 *
 * @param src - Markdown source string.
 * @param gfm - Whether to enable GFM extensions.
 * @returns Static HTML string.
 */
const renderMarkdown = (src: string, gfm: boolean = false): string => {
  const tokens = parse(src, null, { gfm }).tokens;
  return renderToStaticMarkup(createElement("div", null, renderReact(tokens)) as ReactNode);
};

describe("renderReact — block tokens", () => {
  it("renders heading with level class", () => {
    expect(renderMarkdown("# hello")).toContain('<h1 class="streamd-h1">hello</h1>');
  });

  it("renders paragraph with class", () => {
    expect(renderMarkdown("body text\n")).toContain('<p class="streamd-p">body text</p>');
  });

  it("renders blockquote wrapping children", () => {
    const html = renderMarkdown("> quoted\n");
    expect(html).toContain('<blockquote class="streamd-blockquote">');
    expect(html).toContain('<p class="streamd-p">quoted</p>');
  });

  it("renders horizontal rule", () => {
    expect(renderMarkdown("---\n")).toContain('<hr class="streamd-hr"');
  });

  it("renders fenced code with language class", () => {
    const html = renderMarkdown("```js\nlet x=1;\n```\n");
    expect(html).toMatch(/<pre[^>]*class="streamd-pre"[^>]*><code class="language-js">/);
    expect(html).toContain("let x=1;");
  });

  it("renders tight unordered list", () => {
    const html = renderMarkdown("- a\n- b\n");
    expect(html).toContain('<ul class="streamd-ul">');
    expect(html).toMatch(/<li class="streamd-li">\s*a\s*<\/li>/);
  });

  it("renders ordered list with start attribute", () => {
    const html = renderMarkdown("5. a\n");
    expect(html).toContain('start="5"');
  });

  it("renders code block without language as plain pre/code", () => {
    const html = renderMarkdown("```\nplain\n```\n");
    expect(html).toContain('<pre class="streamd-pre"');
    expect(html).toContain("<code>plain");
  });
});

describe("renderReact — inline tokens", () => {
  it("renders strong and em", () => {
    const html = renderMarkdown("**bold** and *em*");
    expect(html).toContain('<strong class="streamd-strong">bold</strong>');
    expect(html).toContain('<em class="streamd-em">em</em>');
  });

  it("renders code span", () => {
    expect(renderMarkdown("a `code` b")).toContain('<code class="streamd-code">code</code>');
  });

  it("renders link with href and title", () => {
    const html = renderMarkdown('[x](/u "t")');
    expect(html).toContain('href="/u"');
    expect(html).toContain('title="t"');
  });

  it("renders image with alt and src", () => {
    const html = renderMarkdown("![alt](/i)");
    expect(html).toContain('alt="alt"');
    expect(html).toContain('src="/i"');
  });

  it("renders hardbreak as br", () => {
    const html = renderMarkdown("a  \nb\n");
    expect(html).toContain('<br class="streamd-br"');
  });

  it("renders escape as literal character", () => {
    const html = renderMarkdown("\\*escaped\\*\n");
    expect(html).toContain("*escaped*");
  });
});

describe("renderReact — component overrides via ReactComponents", () => {
  it("invokes override for code_block with the token", () => {
    const tokens = parse("```js\ncode\n```\n").tokens;
    const MyCode: ComponentType<{ token: Token; children?: ReactNode }> = ({ token }) =>
      createElement("div", { "data-lang": (token as { lang: string }).lang }, "custom");
    const components: ReactComponents = { code_block: MyCode };
    const html = renderToStaticMarkup(
      createElement("div", null, renderReact(tokens, { components })) as ReactNode,
    );
    expect(html).toContain('data-lang="js"');
    expect(html).toContain("custom");
  });

  it("invokes override for paragraph with children", () => {
    const tokens = parse("hello\n").tokens;
    const MyPara: ComponentType<{ token: Token; children?: ReactNode }> = ({ children }) =>
      createElement("section", null, children);
    const components: ReactComponents = { paragraph: MyPara };
    const html = renderToStaticMarkup(
      createElement("div", null, renderReact(tokens, { components })) as ReactNode,
    );
    expect(html).toContain("<section>hello</section>");
  });

  it("invokes override for link with children", () => {
    const tokens = parse("[text](/url)\n").tokens;
    const MyLink: ComponentType<{ token: Token; children?: ReactNode }> = ({ token, children }) =>
      createElement("span", { "data-href": (token as { href: string }).href }, children);
    const components: ReactComponents = { link: MyLink };
    const html = renderToStaticMarkup(
      createElement("div", null, renderReact(tokens, { components })) as ReactNode,
    );
    expect(html).toContain('data-href="/url"');
    expect(html).toContain("text");
  });
});

describe("renderReact — CodeBlock with meta.highlight", () => {
  it("renders structured highlight spans with inline styles", () => {
    const tokens: TokensList = [
      {
        type: "code_block",
        lang: "js",
        content: "let x = 1;",
        meta: {
          highlight: {
            lines: [
              [
                { text: "let", color: "#ff0000" },
                { text: " x = 1;", color: "#00ff00" },
              ],
            ],
            lang: "js",
            theme: "dark",
          },
        },
      },
    ];
    const html = renderToStaticMarkup(createElement("div", null, renderReact(tokens)) as ReactNode);
    expect(html).toContain('style="color:#ff0000"');
    expect(html).toContain('style="color:#00ff00"');
    expect(html).toContain("let");
    expect(html).toContain(" x = 1;");
  });

  it("renders plain code when no highlight data present", () => {
    const tokens: TokensList = [{ type: "code_block", lang: "py", content: "x = 1" }];
    const html = renderToStaticMarkup(createElement("div", null, renderReact(tokens)) as ReactNode);
    expect(html).toContain('<code class="language-py">x = 1</code>');
  });
});

describe("renderReact — math rendering", () => {
  it("renders math block as pre/code by default", () => {
    const tokens: TokensList = [{ type: "math_block", content: "E = mc^2" }];
    const html = renderToStaticMarkup(createElement("div", null, renderReact(tokens)) as ReactNode);
    expect(html).toContain("E = mc^2");
    expect(html).toContain("language-math");
  });

  it("renders math inline as code by default", () => {
    const tokens: TokensList = [
      { type: "paragraph", children: [{ type: "math_inline", content: "x^2" }] },
    ];
    const html = renderToStaticMarkup(createElement("div", null, renderReact(tokens)) as ReactNode);
    expect(html).toContain("x^2");
    expect(html).toContain("math-inline");
  });
});

describe("renderReact — error handling", () => {
  it("throws StreamdReactArgumentError for non-array tokens", () => {
    expect(() => renderReact("not-an-array" as unknown as TokensList)).toThrow(
      StreamdReactArgumentError,
    );
  });

  it("throws StreamdReactArgumentError for unknown token type", () => {
    const badTokens = [{ type: "nonexistent_type", content: "x" }] as unknown as TokensList;
    expect(() =>
      renderToStaticMarkup(createElement("div", null, renderReact(badTokens)) as ReactNode),
    ).toThrow(StreamdReactArgumentError);
  });

  it("returns null for empty token list", () => {
    expect(renderReact([])).toBeNull();
  });
});

describe("StreamdMarkdown — component", () => {
  it("throws when neither source nor tokens provided", () => {
    expect(() => renderToStaticMarkup(createElement(StreamdMarkdown, {}) as ReactNode)).toThrow(
      StreamdReactArgumentError,
    );
  });

  it("renders source prop as markdown", () => {
    const html = renderToStaticMarkup(
      createElement(StreamdMarkdown, { source: "# Hi" }) as ReactNode,
    );
    expect(html).toContain('<h1 class="streamd-h1">Hi</h1>');
  });

  it("renders tokens prop directly", () => {
    const tokens: TokensList = [{ type: "paragraph", children: [{ type: "text", content: "yo" }] }];
    const html = renderToStaticMarkup(createElement(StreamdMarkdown, { tokens }) as ReactNode);
    expect(html).toContain("yo");
  });
});
