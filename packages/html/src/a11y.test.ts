/**
 * Accessibility (H11) tests for the HTML renderer.
 *
 * These tests pin the ARIA + role attributes added in the H11 wave:
 *
 * - Task-list checkbox — role=checkbox / aria-checked / aria-disabled
 * - Table `<th>` — scope=col
 * - Fenced code block — tabindex=0 always, role=region + aria-label only
 *   when a language is set
 * - Math block — role=math + aria-label="math block"
 * - External link with target=_blank — rel augmented with
 *   noopener and noreferrer, idempotently
 * - Heading — id attribute propagated from token.meta.id
 *
 * Fixtures are authored directly as token lists where the markdown surface
 * cannot express the required metadata (for example setting `meta.target`
 * or `meta.id`). This mirrors the pattern used in `meta-attrs-security.test.ts`.
 *
 * @module a11y.test
 */

import { parse, type Token, type TokensList, TokenType } from "@streamd/parser";
import { describe, expect, it } from "vitest";
import { renderHtml } from "./render";

/** Build a single-paragraph token list wrapping a single inline token. */
const paragraphWith = (inline: Token): TokensList =>
  [
    {
      type: TokenType.Paragraph,
      children: [inline],
    },
  ] as unknown as TokensList;

describe("renderHtml — accessibility (H11)", () => {
  it("task-list checkbox emits role=checkbox + aria-checked + aria-disabled (checked)", () => {
    const html = renderHtml(parse("- [x] done\n", null, { gfm: true }).tokens);
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('checked=""');
  });

  it("task-list checkbox emits aria-checked=false for unchecked items", () => {
    const html = renderHtml(parse("- [ ] open\n", null, { gfm: true }).tokens);
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('role="checkbox"');
  });

  it("task-list checkbox respects taskListCheckboxes=none (no aria attrs when suppressed)", () => {
    const html = renderHtml(parse("- [x] done\n", null, { gfm: true }).tokens, {
      taskListCheckboxes: "none",
    });
    expect(html).not.toContain("role=");
    expect(html).not.toContain("aria-");
    expect(html).toContain("[x] done");
  });

  it("table header cells emit scope=col on every th", () => {
    const html = renderHtml(
      parse("| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n", null, { gfm: true }).tokens,
    );
    const scopeMatches = html.match(/scope="col"/g) ?? [];
    expect(scopeMatches.length).toBe(3);
    expect(html).toContain('<th scope="col">a</th>');
  });

  it("code block with language emits tabindex=0 + role=region + aria-label", () => {
    const html = renderHtml(parse("```ts\nconst x = 1;\n```\n").tokens);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="ts code block"');
  });

  it("code block without language emits tabindex=0 but no aria-label", () => {
    const html = renderHtml(parse("```\nplain\n```\n").tokens);
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain('aria-label="');
    expect(html).not.toContain('role="region"');
    expect(html).not.toContain("undefined code");
  });

  it("math block emits role=math + aria-label='math block'", () => {
    const html = renderHtml(parse("$$\nE = mc^2\n$$\n", null, { math: true }).tokens);
    expect(html).toContain('role="math"');
    expect(html).toContain('aria-label="math block"');
    expect(html).toContain("E = mc^2");
  });

  it("math block respects math=none by omitting output", () => {
    const html = renderHtml(parse("$$\nE = mc^2\n$$\n", null, { math: true }).tokens, {
      math: "none",
    });
    expect(html).not.toContain("role=");
    expect(html).not.toContain("aria-label=");
  });

  it("link with target=_blank and no author rel gets rel=noopener noreferrer", () => {
    const tokens = paragraphWith({
      type: TokenType.Link,
      href: "https://external.example",
      title: "",
      meta: { target: "_blank" },
      children: [{ type: TokenType.Text, content: "ext" } as Token],
    } as unknown as Token);
    const html = renderHtml(tokens);
    expect(html).toContain('target="_blank"');
    expect(html).toMatch(/rel="(?:noopener noreferrer|noreferrer noopener)"/);
  });

  it("link with target=_blank and only noopener gets noreferrer appended", () => {
    const tokens = paragraphWith({
      type: TokenType.Link,
      href: "https://external.example",
      title: "",
      meta: { target: "_blank", rel: "noopener" },
      children: [{ type: TokenType.Text, content: "ext" } as Token],
    } as unknown as Token);
    const html = renderHtml(tokens);
    expect(html).toContain("noopener");
    expect(html).toContain("noreferrer");
  });

  it("link with target=_blank and existing rel=noopener noreferrer is idempotent", () => {
    const tokens = paragraphWith({
      type: TokenType.Link,
      href: "https://external.example",
      title: "",
      meta: { target: "_blank", rel: "noopener noreferrer" },
      children: [{ type: TokenType.Text, content: "ext" } as Token],
    } as unknown as Token);
    const html = renderHtml(tokens);
    expect((html.match(/noopener/g) ?? []).length).toBe(1);
    expect((html.match(/noreferrer/g) ?? []).length).toBe(1);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("link with target=_blank preserves author-supplied extra rel tokens", () => {
    const tokens = paragraphWith({
      type: TokenType.Link,
      href: "https://external.example",
      title: "",
      meta: { target: "_blank", rel: "external nofollow" },
      children: [{ type: TokenType.Text, content: "ext" } as Token],
    } as unknown as Token);
    const html = renderHtml(tokens);
    expect(html).toContain("external");
    expect(html).toContain("nofollow");
    expect(html).toContain("noopener");
    expect(html).toContain("noreferrer");
  });

  it("link without target keeps author rel as-is (no augmentation)", () => {
    const tokens = paragraphWith({
      type: TokenType.Link,
      href: "/local",
      title: "",
      meta: { rel: "alternate" },
      children: [{ type: TokenType.Text, content: "local" } as Token],
    } as unknown as Token);
    const html = renderHtml(tokens);
    expect(html).toContain('rel="alternate"');
    expect(html).not.toContain("noopener");
    expect(html).not.toContain("noreferrer");
  });

  it("link without target and no author rel emits no rel attribute", () => {
    const html = renderHtml(parse("[local](/path)\n").tokens);
    expect(html).not.toContain("rel=");
  });

  it("heading emits id when meta.id is present", () => {
    const tokens: TokensList = [
      {
        type: TokenType.Heading,
        level: 2,
        meta: { id: "section-two" },
        children: [{ type: TokenType.Text, content: "Section Two" } as Token],
      },
    ] as unknown as TokensList;
    const html = renderHtml(tokens);
    expect(html).toContain('id="section-two"');
    expect(html).toContain("<h2");
  });

  it("heading without meta.id does not emit an id attribute", () => {
    const html = renderHtml(parse("# Plain\n").tokens);
    expect(html).not.toContain("id=");
  });

  it("combined fixture surfaces dozens of aria / role / scope / tabindex attributes", () => {
    const md =
      "# Title\n\n" +
      "- [x] done\n- [ ] open\n\n" +
      "```ts\nlet x = 1;\n```\n\n" +
      "$$\nE = mc^2\n$$\n\n" +
      "| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n";
    const html = renderHtml(parse(md, null, { gfm: true, math: true }).tokens);

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
