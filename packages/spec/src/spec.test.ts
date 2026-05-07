/**
 * Spec compliance tests for @streamd/parser + @streamd/html.
 *
 * Fixtures (flat .md/.html pairs):
 *   fixtures/commonmark/ — CommonMark 0.31.2 (~655 examples)
 *   fixtures/gfm/        — GFM 0.29 full spec + extensions + regressions (~733 examples)
 *
 * Comparison is whitespace-tolerant via html-minifier-terser.
 * Known divergences are listed in ./skip.ts and skipped individually —
 * update that file as parser coverage improves.
 *
 * @module spec.test
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { minify } from "html-minifier-terser";
import { describe, expect, it } from "vitest";
import { SKIP } from "./skip";

// ── HTML normalization (whitespace-tolerant comparison) ──

/**
 * Normalizes HTML for whitespace-tolerant comparison.
 *
 * Collapses whitespace, removes comments, and sorts attributes via
 * html-minifier-terser. Falls back to naive whitespace collapse when
 * the minifier rejects malformed HTML.
 *
 * @param html - Raw HTML string to normalize. May be empty or malformed.
 * @returns Minified HTML string suitable for equality comparison.
 */
async function normalizeHtml(html: string): Promise<string> {
  if (!html.trim()) return "";

  try {
    return await minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      sortAttributes: true,
    });
  } catch {
    return html.replace(/\s+/g, " ").trim();
  }
}

// ── Discover .md/.html fixture pairs in a directory ──

/**
 * Discovers fixture basenames (without extension) in a directory.
 *
 * Reads all `.md` files, strips the extension, and returns them sorted
 * alphabetically. Each basename corresponds to a `.md`/`.html` pair.
 *
 * @param directory - Absolute path to the fixtures directory.
 * @returns Sorted array of fixture basenames (e.g. `"0001--tabs"`).
 */
function discoverFixtures(directory: string): Array<string> {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => basename(file, ".md"));
}

// ── Test runner ──

/** Absolute path to the `fixtures/` directory containing `.md`/`.html` pairs. */
const fixturesRoot = join(import.meta.dirname, "..", "fixtures");

/** Configuration for a single spec compliance suite. */
interface SuiteConfig {
  /** Human-readable suite name shown in test output (e.g. `"commonmark 0.31.2"`). */
  readonly name: string;
  /** Absolute path to the directory containing `.md`/`.html` fixture pairs. */
  readonly directory: string;
  /** Key into the `SKIP` record to retrieve the skip set for this suite. */
  readonly skipKey: keyof typeof SKIP;
  /** Whether to enable GFM extensions when parsing fixtures in this suite. */
  readonly gfm: boolean;
}

/** Suite definitions driving the test matrix — one entry per spec variant. */
const suites: Array<SuiteConfig> = [
  {
    name: "commonmark 0.31.2",
    directory: join(fixturesRoot, "commonmark"),
    skipKey: "commonmark",
    gfm: false,
  },
  { name: "gfm 0.29", directory: join(fixturesRoot, "gfm"), skipKey: "gfm", gfm: true },
];

for (const { name: suiteName, directory, skipKey, gfm } of suites) {
  const skipSet = SKIP[skipKey];
  const fixtures = discoverFixtures(directory);

  describe(suiteName, () => {
    for (const fixtureName of fixtures) {
      const isSkipped = skipSet?.has(fixtureName);
      const testFn = isSkipped ? it.skip : it;

      testFn(fixtureName, async () => {
        const markdown = readFileSync(join(directory, `${fixtureName}.md`), "utf-8");
        const expectedHtml = readFileSync(join(directory, `${fixtureName}.html`), "utf-8");

        const tokens = parse(markdown, null, { gfm }).tokens;
        const actualHtml = renderHtml(tokens);

        const normalizedActual = await normalizeHtml(actualHtml);
        const normalizedExpected = await normalizeHtml(expectedHtml);

        expect(normalizedActual).toBe(normalizedExpected);
      });
    }
  });
}
