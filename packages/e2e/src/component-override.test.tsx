/**
 * Component-override equivalence — verifies that passing a custom
 * `components` override map to all three renderers produces consistent
 * output semantics (same content, same structure).
 *
 * Scope: a single `code_block` override that wraps content in a
 * `<details>` element (HTML) or a custom React component (React /
 * React-Native). Verifies the override fires in each renderer.
 *
 * @module component-override.test
 */

import { renderHtml } from "@streamd/html";
import { type CodeBlockToken, parse } from "@streamd/parser";
import { renderReact } from "@streamd/react";
import { renderReactNative } from "@streamd/react-native";
import { lightTheme } from "@streamd/tokens";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/** Markdown fixture with a fenced code block. */
const MD = "```js\nconst x = 1;\n```\n";

describe("component-override equivalence", () => {
  it("html renderer fires custom code_block component", () => {
    const tokens = parse(MD).tokens;
    const html = renderHtml(tokens, {
      components: {
        code_block: (token: CodeBlockToken) =>
          `<details><summary>${token.lang}</summary><pre>${token.content}</pre></details>`,
      },
    });
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>js</summary>");
    expect(html).toContain("const x = 1;");
    expect(html).toContain("</details>");
  });

  it("react renderer fires custom code_block component", () => {
    const tokens = parse(MD).tokens;
    const markup = renderToStaticMarkup(
      createElement(
        "div",
        null,
        renderReact(tokens, {
          components: {
            code_block: ({ token }) =>
              createElement(
                "details",
                null,
                createElement("summary", null, token.lang),
                createElement("pre", null, token.content),
              ),
          },
        }),
      ) as ReactNode,
    );
    expect(markup).toContain("<details>");
    expect(markup).toContain("<summary>js</summary>");
    expect(markup).toContain("const x = 1;");
  });

  it("react-native renderer fires custom code_block component", () => {
    const tokens = parse(MD).tokens;
    const markup = renderToStaticMarkup(
      createElement(
        "rn-root",
        null,
        renderReactNative(tokens, {
          theme: lightTheme,
          components: {
            codeBlock: (props: { lang: string; content: string }) =>
              createElement("custom-code", { "data-lang": props.lang }, props.content),
          },
        }),
      ) as ReactNode,
    );
    expect(markup).toContain("custom-code");
    expect(markup).toContain('data-lang="js"');
    expect(markup).toContain("const x = 1;");
  });

  it("all three renderers produce the same content from the override", () => {
    const tokens = parse(MD).tokens;

    const htmlOut = renderHtml(tokens, {
      components: {
        code_block: (token: CodeBlockToken) =>
          `<pre data-lang="${token.lang}">${token.content}</pre>`,
      },
    });

    const reactOut = renderToStaticMarkup(
      renderReact(tokens, {
        components: {
          code_block: ({ token }) =>
            createElement("pre", { "data-lang": token.lang }, token.content),
        },
      }) as ReactNode,
    );

    const rnOut = renderToStaticMarkup(
      renderReactNative(tokens, {
        theme: lightTheme,
        components: {
          codeBlock: (props: { lang: string; content: string }) =>
            createElement("pre", { "data-lang": props.lang }, props.content),
        },
      }) as ReactNode,
    );

    // All three contain the same semantic content
    expect(htmlOut).toContain('data-lang="js"');
    expect(reactOut).toContain('data-lang="js"');
    expect(rnOut).toContain('data-lang="js"');

    expect(htmlOut).toContain("const x = 1;");
    expect(reactOut).toContain("const x = 1;");
    expect(rnOut).toContain("const x = 1;");
  });
});
