/**
 * Plugin-overhead benchmark captured in the structured baseline.
 *
 * Measures `renderHtml(tokens, { plugins })` latency with the built-in
 * bundle `[headingAnchors(), linkAttributes(), sanitize()]` applied to a
 * 50 KB pre-parsed token tree. The baseline record lets CI detect when
 * a plugin change blows up the render pipeline without regressing the
 * plugin-free render case alongside it.
 *
 * Only one record is captured — the 50 KB / 3-plugin case — because the
 * overhead scales linearly with token count and is already measured by
 * the HTML-render static records at other sizes. A single anchor is the
 * minimum signal; widen the inventory only when regressions specific to
 * plugin count or token category appear.
 *
 * @module bench/structured-plugins
 */
import { renderHtml } from "@streamd/html";
import { parse as streamdParse } from "@streamd/parser";
import { headingAnchors, linkAttributes, sanitize } from "@streamd/plugins";
import { buildStaticRecord, measureLatency, snapshotHeap } from "./bench-metrics";
import { generateMixed } from "./generate";
import type { BenchmarkRecord } from "./schema";

/** The exact plugin bundle the task spec pins. Kept in module scope so the bench measures steady-state cost rather than plugin factory construction. */
const PLUGIN_BUNDLE = [headingAnchors(), linkAttributes(), sanitize()] as const;

/** Run the plugin-overhead section. Returns exactly one record. */
export function runPluginOverheadBenches(): Array<BenchmarkRecord> {
  const source = generateMixed(50);
  const tokens = streamdParse(source, null).tokens;
  const before = snapshotHeap();
  const stats = measureLatency(() => renderHtml(tokens, { plugins: PLUGIN_BUNDLE }), 50, 200);
  const after = snapshotHeap();
  return [
    buildStaticRecord({
      id: "plugins.overhead.50kb",
      label: "Plugins: anchors + link-attrs + sanitize on 50 KB tokens",
      kind: "plugin-overhead",
      inputBytes: source.length,
      stats,
      heapUsedBytes: Math.max(0, after - before),
    }),
  ];
}
