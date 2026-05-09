/**
 * Custom component overrides for the react-demo.
 *
 * Demonstrates the `components` override API:
 * - `CustomCodeBlock` — renders syntax-highlighted code with line numbers
 *   using `meta.highlight` from plugin-shiki.
 * - `CustomMathBlock` / `CustomMathInline` — renders TeX via KaTeX,
 *   showing the "KaTeX-via-override" recipe (consumer's explicit choice,
 *   no flag required).
 *
 * @module apps/react-demo/src/components
 */
import type { TokenByType } from "@streamd/react";
import katex from "katex";
import { createElement, type ReactNode } from "react";

/**
 * Custom code block component that reads `meta.highlight` from plugin-shiki
 * and renders styled spans with line numbers. Falls back to plain `<pre><code>`
 * when no highlight data is present.
 *
 * @param props - Token and children from the renderer.
 * @returns Pre-formatted code block with optional syntax highlighting.
 */
export function CustomCodeBlock(props: { readonly token: TokenByType<"code_block"> }): ReactNode {
  const { token } = props;
  const highlight = token.meta?.highlight;

  if (!highlight) {
    return createElement(
      "pre",
      { className: "custom-code-block" },
      createElement("code", null, token.content),
    );
  }

  const lines = highlight.lines.map((line, lineIdx) => {
    const spans = line.map((segment, segIdx) =>
      createElement("span", { key: segIdx, style: { color: segment.color } }, segment.text),
    );

    return createElement("span", { key: lineIdx, className: "code-line" }, ...spans);
  });

  return createElement(
    "pre",
    { className: "custom-code-block highlighted" },
    createElement("code", null, ...lines),
  );
}

/**
 * Custom math block component that renders TeX via KaTeX.
 * Uses `dangerouslySetInnerHTML` — the consumer's explicit choice.
 *
 * @param props - Token containing raw TeX content.
 * @returns A div with rendered KaTeX HTML.
 */
export function CustomMathBlock(props: { readonly token: TokenByType<"math_block"> }): ReactNode {
  const html = katex.renderToString(props.token.content, {
    displayMode: true,
    throwOnError: false,
  });

  return createElement("div", {
    className: "math-block",
    // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX-via-override recipe — consumer's explicit choice
    dangerouslySetInnerHTML: { __html: html },
  });
}

/**
 * Custom math inline component that renders TeX via KaTeX.
 * Uses `dangerouslySetInnerHTML` — the consumer's explicit choice.
 *
 * @param props - Token containing raw TeX content.
 * @returns A span with rendered KaTeX HTML.
 */
export function CustomMathInline(props: { readonly token: TokenByType<"math_inline"> }): ReactNode {
  const html = katex.renderToString(props.token.content, {
    displayMode: false,
    throwOnError: false,
  });

  return createElement("span", {
    className: "math-inline",
    // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX-via-override recipe — consumer's explicit choice
    dangerouslySetInnerHTML: { __html: html },
  });
}
