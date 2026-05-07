/**
 * Accessibility (H11) tests for the React renderer.
 *
 * Uses `react-dom/server.renderToStaticMarkup` so the tests run in Node
 * without a DOM, matching the pattern in `render.test.tsx`. The markup
 * string is grepped for ARIA / role / scope / tabindex attributes added
 * in the H11 wave.
 *
 * Each assertion targets a specific component surface so a regression
 * lands on a precisely-named test rather than a catch-all one.
 *
 * @module a11y.test
 */

import { parse, type Token, type TokensList, TokenType } from "@streamd/parser";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderReact } from "./render";

/** Render the given tokens to a static-markup string wrapped in a `<div>`. */
const renderTokens = (tokens: TokensList): string =>
  renderToStaticMarkup(createElement("div", null, renderReact(tokens)) as ReactNode);

/** Parse markdown and render it to a static-markup string. */
const renderMd = (src: string, gfm = false, math = false): string =>
  renderTokens(parse(src, null, { gfm, math }).tokens);

describe("renderReact — accessibility (H11)", () => {
  it("task-list checkbox exposes role=checkbox + aria-checked=true + aria-disabled", () => {
    const html = renderMd("- [x] done\n", true);
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-disabled="true"');
  });

  it("task-list checkbox exposes aria-checked=false for unchecked items", () => {
    const html = renderMd("- [ ] open\n", true);
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('role="checkbox"');
  });

  it("table header cells emit scope=col on every th", () => {
    const html = renderMd("| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n", true);
    const scopeMatches = html.match(/scope="col"/g) ?? [];
    expect(scopeMatches.length).toBe(3);
  });

  it("code block with language exposes tabindex + role=region + aria-label", () => {
    const html = renderMd("```ts\nlet x = 1;\n```\n");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="ts code block"');
  });

  it("code block without language exposes tabindex but no aria-label / role", () => {
    const html = renderMd("```\nplain\n```\n");
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain('aria-label="');
    expect(html).not.toContain('role="region"');
    expect(html).not.toContain("undefined code");
  });

  it("math block exposes role=math + aria-label='math block'", () => {
    const html = renderMd("$$\nE = mc^2\n$$\n", false, true);
    expect(html).toContain('role="math"');
    expect(html).toContain('aria-label="math block"');
  });

  it("link with target=_blank gets rel=noopener noreferrer defensively", () => {
    const tokens: TokensList = [
      {
        type: TokenType.Paragraph,
        children: [
          {
            type: TokenType.Link,
            href: "https://external.example",
            title: "",
            meta: { target: "_blank" },
            children: [{ type: TokenType.Text, content: "ext" } as Token],
          },
        ],
      },
    ] as unknown as TokensList;
    const html = renderTokens(tokens);
    expect(html).toContain('target="_blank"');
    expect(html).toMatch(/rel="(?:noopener noreferrer|noreferrer noopener)"/);
  });

  it("link with target=_blank and existing rel stays idempotent (no duplicate tokens)", () => {
    const tokens: TokensList = [
      {
        type: TokenType.Paragraph,
        children: [
          {
            type: TokenType.Link,
            href: "https://external.example",
            title: "",
            meta: { target: "_blank", rel: "noopener noreferrer" },
            children: [{ type: TokenType.Text, content: "ext" } as Token],
          },
        ],
      },
    ] as unknown as TokensList;
    const html = renderTokens(tokens);
    expect((html.match(/noopener/g) ?? []).length).toBe(1);
    expect((html.match(/noreferrer/g) ?? []).length).toBe(1);
  });

  it("link with target=_blank and partial rel appends the missing token", () => {
    const tokens: TokensList = [
      {
        type: TokenType.Paragraph,
        children: [
          {
            type: TokenType.Link,
            href: "https://external.example",
            title: "",
            meta: { target: "_blank", rel: "noopener" },
            children: [{ type: TokenType.Text, content: "ext" } as Token],
          },
        ],
      },
    ] as unknown as TokensList;
    const html = renderTokens(tokens);
    expect(html).toContain("noopener");
    expect(html).toContain("noreferrer");
  });

  it("link without target does not get noopener/noreferrer forced on it", () => {
    const html = renderMd("[local](/path)\n");
    expect(html).not.toContain("noopener");
    expect(html).not.toContain("noreferrer");
  });

  it("heading with meta.id propagates to the rendered id attribute", () => {
    const tokens: TokensList = [
      {
        type: TokenType.Heading,
        level: 2,
        meta: { id: "section-two" },
        children: [{ type: TokenType.Text, content: "Section" } as Token],
      },
    ] as unknown as TokensList;
    const html = renderTokens(tokens);
    expect(html).toContain('id="section-two"');
    expect(html).toContain("<h2");
  });

  it("combined fixture surfaces multiple aria / role / scope / tabindex attributes", () => {
    const md =
      "# Title\n\n" +
      "- [x] done\n- [ ] open\n\n" +
      "```ts\nlet x = 1;\n```\n\n" +
      "$$\nE = mc^2\n$$\n\n" +
      "| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n";
    const html = renderMd(md, true, true);

    const roleMatches = html.match(/role="[^"]+"/g) ?? [];
    const ariaMatches = html.match(/aria-[a-z-]+="[^"]*"/g) ?? [];
    const scopeMatches = html.match(/scope="col"/g) ?? [];
    const tabindexMatches = html.match(/tabindex="0"/g) ?? [];

    expect(roleMatches.length).toBeGreaterThanOrEqual(4);
    expect(ariaMatches.length).toBeGreaterThanOrEqual(6);
    expect(scopeMatches.length).toBe(3);
    expect(tabindexMatches.length).toBeGreaterThanOrEqual(1);
  });
});
