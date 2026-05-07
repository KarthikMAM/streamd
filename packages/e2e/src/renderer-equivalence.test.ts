/**
 * Renderer equivalence contract.
 *
 * HTML and React are two paths to the same rendered output. For a given
 * token tree, `renderHtml(tokens)` and `renderToStaticMarkup(renderReact(tokens))`
 * must produce semantically equivalent HTML.
 *
 * "Semantically equivalent" means: same tags, same attributes, same
 * text content. Whitespace is normalized via html-minifier-terser since
 * the two renderers emit slightly different indentation.
 *
 * Differences the contract explicitly allows:
 *  - `class` attribute: React emits `class` via `className`, both produce
 *    the same HTML attr, but the default components differ in class
 *    naming (React uses BEM-style, HTML uses nothing). We strip classes.
 *  - `data-*` attributes added by React keys. Not present in HTML.
 *
 * @module renderer-equivalence.test
 */

import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { renderReact } from "@streamd/react";
import { minify } from "html-minifier-terser";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RenderSample } from "./types";

/** Fixture corpus covering every major token type the two renderers must agree on. */
const SAMPLES: ReadonlyArray<RenderSample> = [
  { name: "heading", markdown: "# Heading\n" },
  { name: "paragraph", markdown: "Plain paragraph.\n" },
  { name: "emphasis", markdown: "*em* and **strong** and ***both***\n" },
  { name: "link", markdown: "[text](https://example.com)\n" },
  { name: "image", markdown: "![alt](image.png)\n" },
  { name: "code span", markdown: "Use `console.log(x)` here.\n" },
  { name: "code block", markdown: "```js\nconst x = 1;\n```\n" },
  { name: "bullet list", markdown: "- a\n- b\n- c\n" },
  { name: "ordered list", markdown: "1. one\n2. two\n3. three\n" },
  { name: "nested list", markdown: "- outer\n  - inner\n    - deep\n" },
  { name: "blockquote", markdown: "> quote text\n" },
  { name: "hr", markdown: "a\n\n---\n\nb\n" },
  {
    name: "mixed",
    markdown: "# T\n\nPara with *em*.\n\n- a\n- b\n\n> q\n\n```\ncode\n```\n",
  },
];

/**
 * Normalize HTML for semantic comparison: collapse whitespace, strip
 * `class` attributes (the two renderers use different class-naming
 * conventions by default), and strip `data-*` attributes.
 *
 * @param html - Raw HTML string from either renderer.
 * @returns Minified, attribute-stripped HTML suitable for equality comparison.
 */
async function normalize(html: string): Promise<string> {
  if (!html.trim()) return "";
  const minified = await minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeAttributeQuotes: false,
    collapseInlineTagWhitespace: false,
  });
  return minified
    .replace(/<link rel="preload"[^>]*>/g, "")
    .replace(/\s+class="[^"]*"/g, "")
    .replace(/\s+data-[a-zA-Z-]+="[^"]*"/g, "");
}

describe("renderer equivalence — HTML ≡ React renderToStaticMarkup", () => {
  for (const { name, markdown } of SAMPLES) {
    it(`${name}`, async () => {
      const tokens = parse(markdown).tokens;
      const fromHtml = renderHtml(tokens);
      const reactNode = renderReact(tokens);
      const fromReact = reactNode === null ? "" : renderToStaticMarkup(reactNode);

      const normalizedHtml = await normalize(fromHtml);
      const normalizedReact = await normalize(fromReact);

      expect(normalizedReact).toBe(normalizedHtml);
    });
  }
});
