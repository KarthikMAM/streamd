/**
 * Plugin overhead benchmark.
 *
 * Measures the incremental cost of running headingAnchors + linkAttributes +
 * sanitize on top of the HTML renderer.
 *
 * Usage: `npx tsx packages/bench/src/plugins.ts`
 *
 * @module bench/plugins
 */
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { headingAnchors, linkAttributes, sanitize } from "@streamd/plugins";
import { formatMs, padEnd, padStart } from "./format";
import { generateMixed } from "./generate";
import { bench } from "./runner";
import type { SizedInput } from "./types";

/** Size tiers for plugin overhead measurement: 1 KB / 10 KB / 50 KB. */
const sizes: ReadonlyArray<SizedInput> = [
  { label: "1 KB", source: generateMixed(1) },
  { label: "10 KB", source: generateMixed(10) },
  { label: "50 KB", source: generateMixed(50) },
];

/** Render options with an empty plugin array — the no-plugin baseline. */
const noPluginsOptions = { plugins: [] as const };

/** The standard 3-plugin bundle: heading anchors, link attributes, and sanitize. */
const pluginBundle = [headingAnchors(), linkAttributes(), sanitize()] as const;

runRenderOnlyOverheadSection();
runFullPipelineOverheadSection();

/** Print plugin overhead with pre-parsed tokens. */
function runRenderOnlyOverheadSection(): void {
  console.log("=== Plugin overhead (render-only, tokens pre-parsed) ===\n");
  console.log(
    padEnd("Input", 10),
    padStart("render (no plugins)", 26),
    padStart("render (3 plugins)", 26),
    padStart("overhead", 12),
  );

  for (const input of sizes) {
    const tokens = parse(input.source, null, { gfm: true }).tokens;
    const baseline = bench("base", () => renderHtml(tokens, noPluginsOptions), "x", 200, 500);
    const withPlugins = bench(
      "plug",
      () => renderHtml(tokens, { plugins: pluginBundle }),
      "x",
      200,
      500,
    );
    const overheadPct = ((withPlugins.median - baseline.median) / baseline.median) * 100;
    console.log(
      padEnd(input.label, 10),
      padStart(formatMs(baseline.median), 26),
      padStart(formatMs(withPlugins.median), 26),
      padStart(`${overheadPct.toFixed(1)}%`, 12),
    );
  }
}

/** Print plugin overhead including parse cost. */
function runFullPipelineOverheadSection(): void {
  console.log("\n=== Plugin overhead (full pipeline: parse + render) ===\n");
  console.log(padEnd("Input", 10), padStart("no plugins", 20), padStart("3 plugins", 20));

  for (const input of sizes) {
    const baseline = bench(
      "base",
      () => renderHtml(parse(input.source, null, { gfm: true }).tokens, noPluginsOptions),
      "x",
      100,
      200,
    );
    const withPlugins = bench(
      "plug",
      () => renderHtml(parse(input.source, null, { gfm: true }).tokens, { plugins: pluginBundle }),
      "x",
      100,
      200,
    );
    console.log(
      padEnd(input.label, 10),
      padStart(formatMs(baseline.median), 20),
      padStart(formatMs(withPlugins.median), 20),
    );
  }
}
