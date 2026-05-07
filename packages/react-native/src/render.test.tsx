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
    try {
      renderReactNative([bogus] as TokensList);
      expect.fail("expected renderReactNative to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(StreamdReactNativeArgumentError);
      const thrown = err as StreamdReactNativeArgumentError;
      expect(thrown.kind).toBe("unknown-token-type");
      expect(thrown.caller).toBe("renderBlock");
      expect(thrown.source).toBe("@streamd/react-native");
    }
  });

  it("throws StreamdReactNativeArgumentError when tokens is not an array (kind=tokens-not-array)", () => {
    try {
      renderReactNative(null as unknown as TokensList);
      expect.fail("expected renderReactNative to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(StreamdReactNativeArgumentError);
      expect((err as StreamdReactNativeArgumentError).kind).toBe("tokens-not-array");
    }
  });

  it("StreamdMarkdownNative throws when neither source nor tokens supplied", () => {
    try {
      renderToStaticMarkup(createElement(StreamdMarkdownNative, {}));
      expect.fail("expected StreamdMarkdownNative to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(StreamdReactNativeArgumentError);
      expect((err as StreamdReactNativeArgumentError).kind).toBe("missing-input");
    }
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
