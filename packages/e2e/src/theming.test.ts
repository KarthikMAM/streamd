/**
 * Theming coupling: the CSS classnames emitted by `renderHtml` (with
 * classPrefix) should correspond to selectors in the output of
 * `renderThemeStylesheet` for the same prefix.
 *
 * Also verifies that switching themes changes only colour / layout values,
 * not the selector set.
 *
 * @module theming.test
 */
import { renderHtml, renderThemeStylesheet } from "@streamd/html";
import { parse } from "@streamd/parser";
import { darkTheme, lightTheme, mergeTheme } from "@streamd/tokens";
import { describe, expect, it } from "vitest";

/** Markdown fixture exercising headings, paragraphs, inline formatting, blockquotes, lists, and code blocks. */
const sampleMd = "# h\n\np **b** *e* `c` [l](/u)\n\n> q\n\n- one\n- two\n\n```js\nx;\n```\n";

/**
 * Extract CSS selectors from a stylesheet string by matching `{` openers.
 *
 * @param css - Raw CSS stylesheet text.
 * @returns Array of selector strings (class or id selectors).
 */
function selectorsFromStylesheet(css: string): Array<string> {
  const out: Array<string> = [];
  const regex = /([.#][a-zA-Z0-9_-]+(?:\s[^{]+)?)\s*\{/g;
  for (;;) {
    const m = regex.exec(css);
    if (!m) break;
    // Capture group 1 is always present when the whole pattern matches.
    // Nullish-coalesce to "" to keep the type system happy without `!`.
    out.push((m[1] ?? "").trim());
  }
  return out;
}

/**
 * Extract the value of a single `--<prefix>-color-background: <value>;`
 * declaration from a stylesheet. Returns an empty string when the
 * declaration is absent — tests can still compare values against a
 * known-different theme to detect drift.
 */
function extractBackgroundColor(css: string, prefix: string): string {
  const regex = new RegExp(`--${prefix}-color-background:\\s*([^;]+);`);
  const match = regex.exec(css);
  if (!match) return "";
  return (match[1] ?? "").trim();
}

describe("theming — selector coverage", () => {
  it("light-theme stylesheet selectors cover all prefixed classes used", () => {
    const html = renderHtml(parse(sampleMd, null, { gfm: true }).tokens, { classPrefix: "md" });
    const stylesheet = renderThemeStylesheet(lightTheme, { classPrefix: "md" });
    const selectors = new Set(selectorsFromStylesheet(stylesheet));

    const classMatches = html.match(/class="([^"]+)"/g) ?? [];
    const emittedClasses = new Set<string>();
    for (const m of classMatches) {
      const names = m.slice(7, -1).split(" ");
      for (const n of names) if (n.startsWith("md-")) emittedClasses.add(n);
    }

    for (const cls of emittedClasses) {
      const selector = `.${cls}`;
      const covered = Array.from(selectors).some((s) => s.includes(selector));
      expect(covered, `expected stylesheet to cover .${cls}`).toBe(true);
    }
  });
});

describe("theming — dark vs light divergence", () => {
  it("switching themes changes the variable values but preserves the selector set", () => {
    const light = renderThemeStylesheet(lightTheme, { classPrefix: "md" });
    const dark = renderThemeStylesheet(darkTheme, { classPrefix: "md" });

    const lightSelectors = selectorsFromStylesheet(light).sort();
    const darkSelectors = selectorsFromStylesheet(dark).sort();
    expect(darkSelectors).toEqual(lightSelectors);

    // Colour values must differ
    const lightBg = extractBackgroundColor(light, "md");
    const darkBg = extractBackgroundColor(dark, "md");
    expect(lightBg).not.toBe(darkBg);
  });
});

describe("theming — mergeTheme overrides", () => {
  it("overriding colour survives stylesheet generation", () => {
    const custom = mergeTheme(lightTheme, { colors: { background: "#fafafa" } });
    const css = renderThemeStylesheet(custom, { classPrefix: "md" });
    expect(css).toContain("--md-color-background: #fafafa");
  });
});
