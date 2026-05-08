/**
 * Unit tests for @streamd/react-native renderer.
 *
 * Uses the `react-native-stub` alias and `renderToStaticMarkup` to
 * serialize the tree. `react-test-renderer` is deprecated in React 19
 * and auto-unmounts synchronously, so markup inspection is a more stable
 * approach for Node-side testing.
 *
 * @module render.test
 */
import { parse, type Token, type TokensList, TokenType } from "@streamd/parser";
import { darkTheme, lightTheme } from "@streamd/tokens";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderReactNative, StreamdMarkdownNative, ThemeProvider } from "./index";
import type { CodeBlockProps, LinkProps } from "./types";
import { StreamdReactNativeArgumentError } from "./validation";

const markup = (node: ReactNode): string =>
  renderToStaticMarkup(createElement("rn-root", null, node) as ReactNode);

describe("renderReactNative — structural output", () => {
  it("renders a paragraph as rn-text", () => {
    const tokens = parse("hello world\n").tokens;
    const html = markup(renderReactNative(tokens));
    expect(html).toContain("<rn-text");
    expect(html).toContain("hello world");
  });

  it("renders a heading", () => {
    const tokens = parse("# title\n").tokens;
    expect(markup(renderReactNative(tokens))).toContain("title");
  });

  it("renders a blockquote as rn-view wrapping content", () => {
    const tokens = parse("> quoted\n").tokens;
    const html = markup(renderReactNative(tokens));
    expect(html).toContain("<rn-view");
    expect(html).toContain("quoted");
  });

  it("renders an ordered list marker", () => {
    const tokens = parse("1. a\n2. b\n").tokens;
    const html = markup(renderReactNative(tokens));
    expect(html).toContain("1. ");
    expect(html).toContain("2. ");
  });

  it("renders a task-list checkbox marker", () => {
    const tokens = parse("- [x] done\n", null, { gfm: true }).tokens;
    expect(markup(renderReactNative(tokens))).toContain("\u2611");
  });

  it("renders a link inside rn-pressable", () => {
    const tokens = parse("[site](/u)").tokens;
    const html = markup(renderReactNative(tokens));
    expect(html).toContain("<rn-pressable");
    expect(html).toContain("site");
  });

  it("renders an image as rn-image", () => {
    const tokens = parse("![alt](/img.png)").tokens;
    const html = markup(renderReactNative(tokens));
    expect(html).toContain("<rn-image");
  });

  it("renders a code block", () => {
    const tokens = parse("```js\nlet x=1;\n```\n").tokens;
    const html = markup(renderReactNative(tokens));
    expect(html).toContain("let x=1;");
  });

  it("renders a table with head cells", () => {
    const tokens = parse("| a | b |\n| --- | --- |\n| 1 | 2 |\n", null, { gfm: true }).tokens;
    const html = markup(renderReactNative(tokens));
    expect(html).toContain("a");
    expect(html).toContain("b");
    expect(html).toContain("1");
    expect(html).toContain("2");
  });

  it("empty input returns null", () => {
    expect(renderReactNative([])).toBeNull();
  });

  it("renders em inline tokens with italic styling", () => {
    const html = markup(renderReactNative(parse("*em*").tokens));
    expect(html).toContain("font-style:italic");
    expect(html).toContain(">em</rn-text>");
  });

  it("renders strong inline tokens with bold weight", () => {
    const html = markup(renderReactNative(parse("**st**").tokens));
    expect(html).toContain("font-weight:700");
    expect(html).toContain(">st</rn-text>");
  });

  it("renders strikethrough inline tokens with line-through decoration", () => {
    const html = markup(renderReactNative(parse("~~gone~~", null, { gfm: true }).tokens));
    expect(html).toContain("text-decoration-line:line-through");
    expect(html).toContain(">gone</rn-text>");
  });

  it("renders inline code spans with monospace family + code-background color", () => {
    const html = markup(renderReactNative(parse("`code`").tokens));
    expect(html).toContain("font-family:ui-monospace");
    expect(html).toContain("background-color:#f6f8fa");
    expect(html).toContain(">code</rn-text>");
  });

  it("renders inline HTML as escaped code-styled text (no injection)", () => {
    const html = markup(renderReactNative(parse("a <span>b</span> c").tokens));
    // Raw HTML is rendered as escaped text inside a monospace rn-text.
    // The angle brackets MUST be entity-escaped so the static-markup
    // serializer doesn't see them as a nested tag.
    expect(html).toContain("&lt;span&gt;");
    expect(html).toContain("&lt;/span&gt;");
    expect(html).not.toContain("<span>b</span>");
  });

  it("renders a backslash escape as the literal escaped character", () => {
    const html = markup(renderReactNative(parse("\\*x").tokens));
    expect(html).toContain(">*x</rn-text>");
    // The backslash itself is consumed by the escape — it must not
    // appear in the rendered output.
    expect(html).not.toContain("\\");
  });

  it("renders a thematic break as a bordered rn-view between adjacent paragraphs", () => {
    const html = markup(renderReactNative(parse("a\n\n---\n\nb\n").tokens));
    // Exactly one rn-view (the hr separator) between the two paragraphs.
    const viewMatches = html.match(/<rn-view\b/g) ?? [];
    expect(viewMatches).toHaveLength(1);
    expect(html).toContain("border-bottom-width:1px");
    expect(html).toContain(">a</rn-text>");
    expect(html).toContain(">b</rn-text>");
  });

  it("renders an HtmlBlock as escaped code-styled text (consistent with inline HTML)", () => {
    const html = markup(renderReactNative(parse("<div>raw block</div>\n").tokens));
    // Raw HTML is NOT parsed — the entire block becomes escaped text
    // inside a monospace rn-text. Tags must be entity-escaped.
    expect(html).toContain("&lt;div&gt;");
    expect(html).toContain("raw block");
    expect(html).toContain("&lt;/div&gt;");
    expect(html).not.toContain("<div>raw block</div>");
  });

  it("renders a MathBlock inside a bordered rn-view container", () => {
    const html = markup(renderReactNative(parse("$$\nE=mc^2\n$$\n", null, { math: true }).tokens));
    // Math block is wrapped in an rn-view with background + border
    // radius styles, distinguishing it from plain paragraphs.
    expect(html).toMatch(/<rn-view style="[^"]*background-color:#f6f8fa[^"]*border-radius/);
    expect(html).toContain("E=mc^2");
  });

  it("renders a MathInline inside a monospace rn-text (same styling as code spans)", () => {
    const html = markup(renderReactNative(parse("a $x$ b", null, { math: true }).tokens));
    // Inline math uses the same monospace + code-background styling as
    // inline code. Assert both markers AND the specific inner content.
    expect(html).toContain("font-family:ui-monospace");
    expect(html).toContain("background-color:#f6f8fa");
    expect(html).toContain(">x</rn-text>");
  });

  it("renders a link inside an rn-pressable with accessibilityRole=link", () => {
    const html = markup(renderReactNative(parse("[text](/href)").tokens));
    expect(html).toContain('<rn-pressable accessibilityRole="link"');
    expect(html).toContain("text-decoration-line:underline");
    expect(html).toContain(">text</rn-text>");
  });
});

describe("renderReactNative — theming", () => {
  it("uses lightTheme by default", () => {
    const html = renderToStaticMarkup(createElement(StreamdMarkdownNative, { source: "hi" }));
    expect(html).toContain(lightTheme.colors.background);
  });

  it("respects an explicit theme prop", () => {
    const html = renderToStaticMarkup(
      createElement(StreamdMarkdownNative, { source: "hi", theme: darkTheme }),
    );
    expect(html).toContain(darkTheme.colors.background);
  });

  it("reads theme from ThemeProvider context", () => {
    const html = renderToStaticMarkup(
      createElement(
        ThemeProvider,
        { theme: darkTheme },
        createElement(StreamdMarkdownNative, { source: "hi" }),
      ),
    );
    expect(html).toContain(darkTheme.colors.background);
  });
});

describe("renderReactNative — custom components", () => {
  it("link override is invoked", () => {
    const MyLink = (props: LinkProps): ReactNode =>
      createElement("rn-custom-link", null, props.children);
    const tokens = parse("[a](/b)").tokens;
    const html = markup(renderReactNative(tokens, { components: { link: MyLink } }));
    expect(html).toContain("<rn-custom-link");
  });
});

describe("renderReactNative — argument validation (H4 + H16)", () => {
  it("throws StreamdReactNativeArgumentError for unknown token types (kind=unknown-token-type)", () => {
    const bogus: Token = { type: 999 as unknown as typeof TokenType.Text, content: "x" } as Token;
    expect(() => renderReactNative([bogus] as TokensList)).toThrow(StreamdReactNativeArgumentError);
    expect(() => renderReactNative([bogus] as TokensList)).toThrow(
      expect.objectContaining({
        kind: "unknown-token-type",
        caller: "renderBlock",
        source: "@streamd/react-native",
      }),
    );
  });

  it("throws StreamdReactNativeArgumentError when tokens is not an array (kind=tokens-not-array)", () => {
    expect(() => renderReactNative(null as unknown as TokensList)).toThrow(
      StreamdReactNativeArgumentError,
    );
    expect(() => renderReactNative(null as unknown as TokensList)).toThrow(
      expect.objectContaining({ kind: "tokens-not-array" }),
    );
  });

  it("StreamdMarkdownNative throws when neither source nor tokens supplied", () => {
    expect(() => renderToStaticMarkup(createElement(StreamdMarkdownNative, {}))).toThrow(
      StreamdReactNativeArgumentError,
    );
    expect(() => renderToStaticMarkup(createElement(StreamdMarkdownNative, {}))).toThrow(
      expect.objectContaining({ kind: "missing-input" }),
    );
  });
});

describe("renderReactNative — C1 allowDangerousMetaHtml parity", () => {
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

  it("default RN CodeBlock never emits raw HTML, regardless of flag", () => {
    const tokens = buildCodeBlockTokens();
    const off = renderToStaticMarkup(
      createElement(
        "rn-root",
        null,
        renderReactNative(tokens, { allowDangerousMetaHtml: false }),
      ) as ReactNode,
    );
    const on = renderToStaticMarkup(
      createElement(
        "rn-root",
        null,
        renderReactNative(tokens, { allowDangerousMetaHtml: true }),
      ) as ReactNode,
    );
    // RN has no dangerouslySetInnerHTML; plain `content` renders in both cases.
    expect(off).not.toContain("class='hl'");
    expect(on).not.toContain("class='hl'");
    expect(off).toContain("let x=1;");
    expect(on).toContain("let x=1;");
  });

  it("custom CodeBlock override receives html + allowDangerousMetaHtml for parity", () => {
    const tokens = buildCodeBlockTokens();
    let capturedHtml: string | undefined;
    let capturedFlag: boolean | undefined;
    const CaptureCodeBlock = (props: CodeBlockProps): ReactNode => {
      capturedHtml = props.html;
      capturedFlag = props.allowDangerousMetaHtml;
      return null;
    };
    renderToStaticMarkup(
      createElement(
        "rn-root",
        null,
        renderReactNative(tokens, {
          allowDangerousMetaHtml: true,
          components: { codeBlock: CaptureCodeBlock },
        }),
      ) as ReactNode,
    );
    expect(capturedHtml).toBe(pluginInjectedHtml);
    expect(capturedFlag).toBe(true);
  });
});
