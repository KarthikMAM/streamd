/**
 * Security tests for the `meta.attrs` allowlist and the opt-in
 * `meta.html` passthrough gate.
 *
 * Covers:
 * - Event-handler attributes (`onclick`, `onerror`) are rejected.
 * - Tag-breakout characters (`"><script>`) in attribute names are rejected.
 * - Allowlisted names (`data-*`, `aria-*`, `role`, `title`, …) are accepted.
 * - `href` / `src` values with unsafe schemes are rewritten to the `#`
 *   fallback.
 * - `meta.html` is ignored unless the caller opts in via
 *   `allowDangerousMetaHtml: true`.
 *
 * These assertions pin the XSS fixes (C1, C2) in place — any regression
 * that re-introduces raw `meta.html` or `meta.attrs` emission fails here
 * before the build reaches a downstream consumer.
 *
 * @module meta-attrs-security.test
 */

import type { HeadingToken, ParagraphToken, TextToken, TokenMeta } from "@streamd/parser";
import { TokenType } from "@streamd/parser";
import { describe, expect, it } from "vitest";
import { renderHtml } from "./render";

/**
 * Build a heading token whose meta is the caller-supplied shape. Using a
 * heading keeps the emitted markup compact (`<h1>…</h1>`) so assertions can
 * match the full output instead of scanning a longer fragment.
 *
 * @param meta - Token meta to attach (pass `{ attrs: {...} }` to drive the
 *   allowlist, `{ html: "..." }` to exercise the passthrough gate).
 * @param text - Optional body text rendered inside the heading.
 * @returns A fresh token tree consisting of one heading + text child.
 */
function buildHeading(meta: TokenMeta, text: string = "t"): Array<HeadingToken> {
  const child: TextToken = { type: TokenType.Text, content: text };
  return [{ type: TokenType.Heading, level: 1, children: [child], meta }];
}

/**
 * Build a paragraph token with the supplied meta — used by the `meta.html`
 * passthrough tests, where the gated code path lives on block dispatch.
 *
 * @param meta - Token meta containing the `html` override under test.
 * @returns A paragraph token tree that can be rendered by {@link renderHtml}.
 */
function buildParagraph(meta: TokenMeta): Array<ParagraphToken> {
  const child: TextToken = { type: TokenType.Text, content: "body" };
  return [{ type: TokenType.Paragraph, children: [child], meta }];
}

describe("meta.attrs allowlist — event-handler rejection", () => {
  it("rejects onclick", () => {
    const html = renderHtml(buildHeading({ attrs: { onclick: "alert(1)" } }));
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("alert(1)");
    expect(html).toBe("<h1>t</h1>\n");
  });

  it("rejects onerror", () => {
    const html = renderHtml(buildHeading({ attrs: { onerror: "alert(1)" } }));
    expect(html).not.toContain("onerror");
    expect(html).toBe("<h1>t</h1>\n");
  });

  it("rejects camel-cased OnClick (case-insensitive on prefix)", () => {
    const html = renderHtml(buildHeading({ attrs: { OnClick: "alert(1)" } }));
    expect(html.toLowerCase()).not.toContain("onclick");
    expect(html).toBe("<h1>t</h1>\n");
  });
});

describe("meta.attrs allowlist — tag-breakout rejection", () => {
  it('drops a name containing "><script>', () => {
    const html = renderHtml(buildHeading({ attrs: { '"><script>': "x" } }));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"><');
    expect(html).toBe("<h1>t</h1>\n");
  });

  it("drops a name containing whitespace", () => {
    const html = renderHtml(buildHeading({ attrs: { "bad name": "x" } }));
    expect(html).toBe("<h1>t</h1>\n");
  });

  it("drops a name containing a quote", () => {
    const html = renderHtml(buildHeading({ attrs: { 'a"b': "x" } }));
    expect(html).toBe("<h1>t</h1>\n");
  });

  it("drops an empty-string name", () => {
    const html = renderHtml(buildHeading({ attrs: { "": "x" } }));
    expect(html).toBe("<h1>t</h1>\n");
  });
});

describe("meta.attrs allowlist — accepted names", () => {
  it("accepts data-user-id", () => {
    const html = renderHtml(buildHeading({ attrs: { "data-user-id": "42" } }));
    expect(html).toBe('<h1 data-user-id="42">t</h1>\n');
  });

  it("accepts aria-label", () => {
    const html = renderHtml(buildHeading({ attrs: { "aria-label": "close" } }));
    expect(html).toBe('<h1 aria-label="close">t</h1>\n');
  });

  it('accepts role="button"', () => {
    const html = renderHtml(buildHeading({ attrs: { role: "button" } }));
    expect(html).toBe('<h1 role="button">t</h1>\n');
  });

  it("accepts title, lang, dir", () => {
    const html = renderHtml(buildHeading({ attrs: { title: "hi", lang: "en", dir: "ltr" } }));
    expect(html).toContain('title="hi"');
    expect(html).toContain('lang="en"');
    expect(html).toContain('dir="ltr"');
  });

  it("HTML-escapes accepted attribute values", () => {
    const html = renderHtml(buildHeading({ attrs: { title: '"><script>' } }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("skips class and id — dedicated paths handle them", () => {
    const html = renderHtml(
      buildHeading({
        attrs: { class: "plugin-added", id: "plugin-id" },
        className: "via-className",
        id: "via-id",
      }),
    );
    expect(html).toContain('class="via-className"');
    expect(html).toContain('id="via-id"');
    expect(html).not.toContain("plugin-added");
    expect(html).not.toContain("plugin-id");
  });

  it("rejects non-allowlisted lowercase names that aren't data/aria", () => {
    const html = renderHtml(buildHeading({ attrs: { tabindex: "0" } }));
    expect(html).toBe("<h1>t</h1>\n");
  });

  it("rejects uppercase data-* (strict lowercase required)", () => {
    const html = renderHtml(buildHeading({ attrs: { "DATA-FOO": "1" } }));
    expect(html).toBe("<h1>t</h1>\n");
  });

  it("rejects data- without a suffix", () => {
    const html = renderHtml(buildHeading({ attrs: { "data-": "x" } }));
    expect(html).toBe("<h1>t</h1>\n");
  });
});

describe("meta.attrs allowlist — href / src scheme sanitization", () => {
  it('normalizes href="javascript:alert(1)" to the safe fallback', () => {
    const html = renderHtml(buildHeading({ attrs: { href: "javascript:alert(1)" } }));
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("alert(1)");
    expect(html).toContain('href="#"');
  });

  it('normalizes src="javascript:alert(1)" to the safe fallback', () => {
    const html = renderHtml(buildHeading({ attrs: { src: "javascript:alert(1)" } }));
    expect(html).not.toContain("javascript:");
    expect(html).toContain('src="#"');
  });

  it("strips whitespace and case before scheme check", () => {
    const html = renderHtml(buildHeading({ attrs: { href: "  JaVaScRiPt:alert(1)" } }));
    expect(html.toLowerCase()).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("rejects vbscript:", () => {
    const html = renderHtml(buildHeading({ attrs: { href: "vbscript:msgbox(1)" } }));
    expect(html).toContain('href="#"');
    expect(html).not.toContain("vbscript:");
  });

  it("rejects data: URLs", () => {
    const html = renderHtml(
      buildHeading({ attrs: { src: "data:text/html,<script>alert(1)</script>" } }),
    );
    expect(html).toContain('src="#"');
    expect(html).not.toContain("<script>");
  });

  it("preserves safe https URLs (percent-encoded via normalizeUrl)", () => {
    const html = renderHtml(buildHeading({ attrs: { href: "https://example.com/a b" } }));
    expect(html).toContain('href="https://example.com/a%20b"');
  });

  it("preserves relative URLs", () => {
    const html = renderHtml(buildHeading({ attrs: { href: "/about" } }));
    expect(html).toContain('href="/about"');
  });
});

describe("meta.html passthrough — opt-in gate", () => {
  it("ignores meta.html by default (allowDangerousMetaHtml=false)", () => {
    const dangerous = "<script>alert(1)</script>";
    const tokens = buildParagraph({ html: dangerous });
    const html = renderHtml(tokens);
    expect(html).not.toContain("<script>");
    expect(html).toBe("<p>body</p>\n");
  });

  it("ignores meta.html when flag is explicitly false", () => {
    const tokens = buildParagraph({ html: "<script>x</script>" });
    const html = renderHtml(tokens, { allowDangerousMetaHtml: false });
    expect(html).toBe("<p>body</p>\n");
  });

  it("emits meta.html verbatim when flag is true (audited-plugins path)", () => {
    const payload = '<pre class="hl"><code>ok</code></pre>';
    const tokens = buildParagraph({ html: payload });
    const html = renderHtml(tokens, { allowDangerousMetaHtml: true });
    expect(html).toBe(payload);
  });

  it("passes allowDangerousMetaHtml through the block-dispatch path with other meta", () => {
    const tokens = buildParagraph({ html: "<strong>x</strong>", className: "unused" });
    const gated = renderHtml(tokens);
    const opened = renderHtml(tokens, { allowDangerousMetaHtml: true });
    expect(gated).toContain("<p");
    expect(gated).not.toContain("<strong>");
    expect(opened).toBe("<strong>x</strong>");
  });
});
