/**
 * End-to-end tests for @streamd/plugins integrated with the html and
 * React renderers.
 *
 * @module plugins.test
 */
import { renderHtml } from "@streamd/html";
import { parse, type TokensList, TokenType } from "@streamd/parser";
import {
  composePlugins,
  headingAnchors,
  highlightCode,
  linkAttributes,
  preprocessSource,
  sanitize,
} from "@streamd/plugins";
import { renderReact } from "@streamd/react";
import { renderReactNative } from "@streamd/react-native";
import { lightTheme } from "@streamd/tokens";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("headingAnchors integration", () => {
  const md = "# Getting Started\n\n## Install\n\n## Install\n";

  it("html output contains id attributes", () => {
    const html = renderHtml(parse(md).tokens, { plugins: [headingAnchors()] });
    expect(html).toContain('id="getting-started"');
    expect(html).toContain('id="install"');
    expect(html).toContain('id="install-2"');
  });

  it("react output carries id on headings", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(parse(md).tokens, { plugins: [headingAnchors()] }),
      ) as ReactNode,
    );
    expect(markup).toContain('id="install-2"');
  });
});

describe("linkAttributes integration", () => {
  const md = "[ext](https://x.com) and [anchor](#sec) and [rel](./rel)\n";

  it("html emits rel/target on external links only", () => {
    const html = renderHtml(parse(md).tokens, { plugins: [linkAttributes()] });
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html.match(/target="_blank"/g)?.length).toBe(1);
  });

  it("react renders rel/target attributes on anchor elements", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(parse(md).tokens, { plugins: [linkAttributes()] }),
      ) as ReactNode,
    );
    expect(markup).toContain("https://x.com");
    expect(markup).toContain('target="_blank"');
  });
});

describe("highlightCode integration", () => {
  const md = "```js\nlet x = 1;\n```\n\n```\nplain\n```\n";

  it("html emits styled spans from meta.highlight for fenced code blocks", () => {
    const html = renderHtml(parse(md).tokens, {
      plugins: [
        highlightCode({
          highlight: (code, lang) => ({
            lines: [[{ text: code }]],
            lang,
            theme: "light",
          }),
        }),
      ],
    });
    expect(html).toContain("let x = 1;");
    expect(html).toContain("plain");
  });

  it("react renders styled spans from meta.highlight for highlighted blocks", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(parse(md).tokens, {
          plugins: [
            highlightCode({
              highlight: (code, lang) => ({
                lines: [[{ text: code, color: "#f00" }]],
                lang,
                theme: "light",
              }),
            }),
          ],
        }),
      ) as ReactNode,
    );
    expect(markup).toContain("let x = 1;");
    expect(markup).toContain("color");
  });
});

describe("sanitize integration", () => {
  const md = "[bad](javascript:x) [ok](https://x)\n";

  it("html rewrites unsafe links", () => {
    const html = renderHtml(parse(md).tokens, { plugins: [sanitize()] });
    expect(html).not.toContain("javascript:");
    expect(html).toContain("https://x");
  });

  it("react does not render unsafe links", () => {
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(parse(md).tokens, { plugins: [sanitize()] }),
      ) as ReactNode,
    );
    expect(markup).not.toContain("javascript:");
  });
});

describe("frontmatter integration", () => {
  it("preprocessSource extracts frontmatter before parsing", () => {
    const src = "---\ntitle: X\nauthor: Y\n---\n# body\n";
    const { source, frontmatter: fm } = preprocessSource(src);
    const html = renderHtml(parse(source).tokens);
    expect(html.trim()).toBe("<h1>body</h1>");
    expect(fm).toEqual({ title: "X", author: "Y" });
  });
});

describe("composed plugin pipeline", () => {
  it("runs anchors + linkAttributes + sanitize together on one document", () => {
    const md = "# A\n\n[ext](https://x) [bad](javascript:x)\n\n# A\n";
    const pipeline = composePlugins("bundle", [headingAnchors(), linkAttributes(), sanitize()]);
    const html = renderHtml(parse(md).tokens, { plugins: [pipeline] });
    expect(html).toContain('id="a"');
    expect(html).toContain('id="a-2"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("javascript:");
  });
});

describe("react-native plugin pipeline", () => {
  it("linkAttributes + sanitize produce safe RN output", () => {
    const md = "[ok](https://x) [bad](javascript:x)\n";
    const markup = renderToStaticMarkup(
      createElement(
        "rn-root",
        null,
        renderReactNative(parse(md).tokens, {
          plugins: [linkAttributes(), sanitize()],
          theme: lightTheme,
        }),
      ) as ReactNode,
    );
    // Both link labels survive, the bad scheme never appears in output
    expect(markup).toContain(">ok<");
    expect(markup).toContain(">bad<");
    expect(markup).not.toContain("javascript:");
  });
});

describe("plugin idempotence under streaming", () => {
  it("headingAnchors assigns stable ids regardless of run count", () => {
    const tokens = parse("# a\n\n# a\n\n# a\n").tokens;
    const plugin = headingAnchors();
    const once = plugin.transform(tokens, { meta: {} });
    const twice = plugin.transform(once, { meta: {} });
    const extractIds = (ts: TokensList): Array<string | undefined> =>
      ts.filter((t) => t.type === TokenType.Heading).map((t) => t.meta?.id);
    expect(extractIds(once)).toEqual(extractIds(twice));
  });
});
