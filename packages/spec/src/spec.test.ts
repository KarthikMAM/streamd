/**
 * Spec compliance tests for @streamd/parser.
 *
 * Fixtures (flat .md/.html pairs):
 *   fixtures/commonmark/ — CommonMark 0.31.2 (655 examples)
 *   fixtures/gfm/        — GFM 0.29 full spec + extensions + regressions (733 examples)
 *
 * parse() and render() are stubs. Tests use .not.toBe so they pass
 * while the parser is unimplemented. Flip to .toBe when ready.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { minify } from "html-minifier-terser";
import { describe, expect, it } from "vitest";
import { SKIP } from "./skip";

// ── Stubs — replace with @streamd/parser imports ──

function parse(_markdown: string): unknown[] {
  return [];
}

function render(_tokens: unknown[]): string {
  return "NOT_YET_IMPLEMENTED";
}

// ── HTML normalization (whitespace-tolerant comparison) ──

async function normalizeHtml(html: string): Promise<string> {
  if (!html.trim()) return "";

  try {
    return await minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      sortAttributes: true,
    });
  } catch {
    // Some spec fixtures contain intentionally malformed HTML
    return html.replace(/\s+/g, " ").trim();
  }
}

// ── Discover .md/.html fixture pairs in a directory ──

function discoverFixtures(directory: string): string[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => basename(file, ".md"));
}

// ── Test runner ──

const fixturesRoot = join(import.meta.dirname, "..", "fixtures");

const suites = [
  { name: "commonmark 0.31.2", directory: join(fixturesRoot, "commonmark"), skipKey: "commonmark" },
  { name: "gfm 0.29", directory: join(fixturesRoot, "gfm"), skipKey: "gfm" },
];

for (const { name: suiteName, directory, skipKey } of suites) {
  const skipSet = SKIP[skipKey];
  const fixtures = discoverFixtures(directory);

  describe(suiteName, () => {
    for (const fixtureName of fixtures) {
      const testFn = skipSet?.has(fixtureName) ? it.skip : it;

      testFn(fixtureName, async () => {
        const markdown = readFileSync(join(directory, `${fixtureName}.md`), "utf-8");
        const expectedHtml = readFileSync(join(directory, `${fixtureName}.html`), "utf-8");

        const tokens = parse(markdown);
        const actualHtml = render(tokens);

        const normalizedActual = await normalizeHtml(actualHtml);
        const normalizedExpected = await normalizeHtml(expectedHtml);

        // TODO: flip to .toBe() once parser + renderer are implemented
        expect(normalizedActual).not.toBe(normalizedExpected);
      });
    }
  });
}
