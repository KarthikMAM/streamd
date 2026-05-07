/**
 * react-vs-html parity: for a curated set of markdown inputs, the React
 * renderer's server-rendered markup should match the HTML renderer's
 * output after whitespace normalization.
 *
 * This is not a strict character-equal comparison — the React renderer
 * emits className attributes that the HTML renderer omits by default, so
 * we configure matching options on both sides.
 *
 * @module react-html-parity.test
 */
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { renderReact } from "@streamd/react";
import { minify } from "html-minifier-terser";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ParityCase } from "./types";

async function norm(html: string): Promise<string> {
  if (!html.trim()) return "";
  // React 19 SSR emits <link rel="preload" as="image"> hints for images —
  // strip them so we compare only the body markup.
  const stripped = html.replace(/<link\b[^>]*as="image"[^>]*>/g, "");
  try {
    return await minify(stripped, {
      collapseWhitespace: true,
      removeComments: true,
      sortAttributes: true,
    });
  } catch {
    return stripped.replace(/\s+/g, " ").trim();
  }
}

const cases: ReadonlyArray<ParityCase> = [
  { name: "heading", md: "# title\n" },
  { name: "paragraph", md: "plain text\n" },
  { name: "bold + em", md: "**bold** and *em*\n" },
  { name: "code span", md: "use `x` please\n" },
  { name: "blockquote", md: "> quoted text\n" },
  { name: "fenced code", md: "```js\nlet x=1;\n```\n" },
  { name: "tight list", md: "- one\n- two\n- three\n" },
  { name: "ordered list", md: "1. a\n2. b\n" },
  { name: "link", md: '[site](/u "t")\n' },
  { name: "image", md: "![alt](/img.png)\n" },
  { name: "hr", md: "---\n" },
  { name: "strikethrough", md: "~~gone~~\n", gfm: true },
  { name: "table", md: "| a | b |\n| --- | --- |\n| 1 | 2 |\n", gfm: true },
];

describe("react-vs-html parity", () => {
  for (const { name, md, gfm } of cases) {
    it(`matches for: ${name}`, async () => {
      const tokens = parse(md, null, { gfm: gfm === true }).tokens;
      const html = renderHtml(tokens, { classPrefix: "streamd" });
      const reactMarkup = renderToStaticMarkup(renderReact(tokens) as ReactNode);
      expect(await norm(reactMarkup)).toBe(await norm(html));
    });
  }
});
