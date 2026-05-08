/**
 * Unit tests for @streamd/react-native renderer.
 *
 * Uses the `react-native-stub` alias and `renderToStaticMarkup` to
 * serialize the tree.
 *
 * @module render.test
 */
import { parse, type Token, type TokensList } from "@streamd/parser";
import { darkTheme, lightTheme } from "@streamd/tokens";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderReactNative, StreamdMarkdownNative, ThemeProvider } from "./index";
import type { CodeBlockProps, LinkProps } from "./types";
import { StreamdReactNativeArgumentError } from "./validation";

/** Wraps a ReactNode in a root element and serializes to HTML string. */
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

  it("renders a backslash escape as the literal escaped character", () => {
    const html = markup(renderReactNative(parse("\\*x").tokens));
    expect(html).toContain("*");
    expect(html).not.toContain("\\");
  });

  it("renders a thematic break as a bordered rn-view between adjacent paragraphs", () => {
    const html = markup(renderReactNative(parse("a\n\n---\n\nb\n").tokens));
    const viewMatches = html.match(/<rn-view\b/g) ?? [];
    expect(viewMatches.length).toBeGreaterThanOrEqual(1);
    expect(html).toContain("border-bottom-width:1px");
  });

  it("renders a MathBlock inside a bordered rn-view container", () => {
    const html = markup(renderReactNative(parse("$$\nE=mc^2\n$$\n", null, { math: true }).tokens));
    expect(html).toMatch(/<rn-view style="[^"]*background-color:#f6f8fa[^"]*border-radius/);
    expect(html).toContain("E=mc^2");
  });

  it("renders a MathInline inside a monospace rn-text (same styling as code spans)", () => {
    const html = markup(renderReactNative(parse("a $x$ b", null, { math: true }).tokens));
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

  it("code_block override is invoked with highlight data", () => {
    const tokens: TokensList = [
      {
        type: "code_block" as const,
        lang: "js",
        content: "let x=1;",
        meta: {
          highlight: {
            lines: [[{ text: "let x=1;", color: "#ff0000" }]],
            lang: "js",
            theme: "light",
          },
        },
      },
    ];
    let capturedHighlight: unknown;
    const CaptureCodeBlock = (props: CodeBlockProps): ReactNode => {
      capturedHighlight = props.highlight;
      return createElement("rn-custom-code", null, props.content);
    };
    const html = markup(
      renderReactNative(tokens, { components: { code_block: CaptureCodeBlock } }),
    );
    expect(html).toContain("<rn-custom-code");
    expect(capturedHighlight).toEqual({
      lines: [[{ text: "let x=1;", color: "#ff0000" }]],
      lang: "js",
      theme: "light",
    });
  });
});

describe("renderReactNative — CodeBlock with meta.highlight", () => {
  it("renders per-segment Text nodes with color styles when highlight is present", () => {
    const tokens: TokensList = [
      {
        type: "code_block" as const,
        lang: "js",
        content: "let x = 1;",
        meta: {
          highlight: {
            lines: [
              [
                { text: "let", color: "#0000ff", bold: true },
                { text: " x = ", color: "#333333" },
                { text: "1", color: "#ff0000" },
                { text: ";", color: "#333333" },
              ],
            ],
            lang: "js",
            theme: "light",
          },
        },
      },
    ];
    const html = markup(renderReactNative(tokens));
    expect(html).toContain("color:#0000ff");
    expect(html).toContain("font-weight:700");
    expect(html).toContain(">let</rn-text>");
    expect(html).toContain("color:#ff0000");
    expect(html).toContain(">1</rn-text>");
  });

  it("renders plain content when highlight is absent", () => {
    const tokens: TokensList = [{ type: "code_block" as const, lang: "js", content: "let x=1;" }];
    const html = markup(renderReactNative(tokens));
    expect(html).toContain("let x=1;");
    expect(html).not.toContain("color:#0000ff");
  });
});

describe("renderReactNative — argument validation", () => {
  it("throws StreamdReactNativeArgumentError for unknown token types (kind=unknown-token-type)", () => {
    const bogus: Token = { type: "bogus_type" as never } as Token;
    expect(() => renderReactNative([bogus] as TokensList)).toThrow(StreamdReactNativeArgumentError);
    expect(() => renderReactNative([bogus] as TokensList)).toThrow(
      expect.objectContaining({ kind: "unknown-token-type" }),
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

describe("renderReactNative — allowDangerousMetaHtml throws on use", () => {
  it("StreamdMarkdownNative throws deprecated-option when allowDangerousMetaHtml is passed", () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(StreamdMarkdownNative, {
          source: "hi",
          allowDangerousMetaHtml: true,
        } as Record<string, unknown>),
      ),
    ).toThrow(StreamdReactNativeArgumentError);
    expect(() =>
      renderToStaticMarkup(
        createElement(StreamdMarkdownNative, {
          source: "hi",
          allowDangerousMetaHtml: true,
        } as Record<string, unknown>),
      ),
    ).toThrow(expect.objectContaining({ kind: "deprecated-option" }));
  });
});
