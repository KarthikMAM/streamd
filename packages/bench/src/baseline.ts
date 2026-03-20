/**
 * Baseline benchmark — captures static and streaming performance.
 *
 * Run before and after changes to verify zero static regression
 * and measure streaming improvements.
 *
 * Usage: npx tsx packages/bench/src/baseline.ts
 *
 * @module bench/baseline
 */
import { parse as streamdParse } from "@streamd/parser";
import { generateCode, generateMixed, generateParagraphs } from "./generate";
import { bench, benchStreaming } from "./runner";

function printTable(rows: Array<Array<string>>): void {
  if (rows.length === 0) return;
  const cols = rows[0]!.length;
  const widths: Array<number> = [];
  for (let c = 0; c < cols; c++) {
    let max = 0;
    for (const row of rows) {
      if (row[c]!.length > max) max = row[c]!.length;
    }
    widths.push(max);
  }
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r]!.map((cell, c) =>
      c === 0 ? cell.padEnd(widths[c]!) : cell.padStart(widths[c]!),
    );
    console.log(`| ${cells.join(" | ")} |`);
    if (r === 0) console.log(`|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`);
  }
}

function fmtMs(ms: number): string {
  if (ms < 0.001) return (ms * 1_000_000).toFixed(0) + " ns";
  if (ms < 1) return (ms * 1000).toFixed(1) + " \u00B5s";
  return ms.toFixed(3) + " ms";
}

// ── Static parse ──────────────────────────────────────────────

console.log("=== Static Parse (@streamd/parser only) ===\n");

const staticInputs = [
  { label: "Mixed 1 KB", src: generateMixed(1), warmup: 500, iter: 5000 },
  { label: "Mixed 10 KB", src: generateMixed(10), warmup: 200, iter: 2000 },
  { label: "Mixed 50 KB", src: generateMixed(50), warmup: 100, iter: 500 },
  { label: "Mixed 500 KB", src: generateMixed(500), warmup: 20, iter: 100 },
  { label: "Paragraphs 50 KB", src: generateParagraphs(50), warmup: 100, iter: 500 },
  { label: "Code blocks 50 KB", src: generateCode(50), warmup: 100, iter: 500 },
  { label: "Pathological * x10000", src: "*".repeat(10000), warmup: 200, iter: 2000 },
  { label: "Pathological > x200", src: "> ".repeat(200) + "text", warmup: 200, iter: 2000 },
];

const staticRows: Array<Array<string>> = [["Input", "Median", "p95", "Throughput"]];
for (const { label, src, warmup, iter } of staticInputs) {
  const r = bench(label, (s) => streamdParse(s), src, warmup, iter);
  staticRows.push([label, fmtMs(r.median), fmtMs(r.p95), r.throughput.toFixed(1) + " MB/s"]);
}
printTable(staticRows);

// ── Streaming: fast-path breakdown ────────────────────────────

console.log("\n=== Streaming Fast-Path Breakdown (50 KB mixed) ===\n");
console.log("Each row simulates LLM streaming at different chunk sizes.\n");

const streamSrc = generateMixed(50);
const streamHeader = ["Scenario", "Chunks", "Total", "Per chunk (median)", "Throughput"];
const streamRows: Array<Array<string>> = [streamHeader];

for (const cs of [3, 10, 50, 200, 1000]) {
  const r = benchStreaming(
    `${cs}B chunks`,
    (acc: string, state?: unknown) => streamdParse(acc, state as null),
    streamSrc,
    cs,
    20,
    50,
  );
  streamRows.push([
    `Mixed ${cs}B chunks`,
    String(r.numChunks),
    fmtMs(r.totalMs),
    fmtMs(r.perChunkMedianMs),
    r.throughput.toFixed(1) + " MB/s",
  ]);
}

// Full parse baseline for comparison
const fullR = bench("full", (s) => streamdParse(s), streamSrc, 100, 500);
streamRows.push([
  "Full parse (no streaming)",
  "1",
  fmtMs(fullR.median),
  "\u2014",
  fullR.throughput.toFixed(1) + " MB/s",
]);

printTable(streamRows);

// ── Streaming: content-type breakdown ─────────────────────────

console.log("\n=== Streaming by Content Type (10 KB, 50B chunks) ===\n");
console.log("Tests which fast paths fire for different content.\n");

const contentTypes = [
  {
    label: "Plain text (no special chars)",
    src: "The quick brown fox jumps over the lazy dog and keeps running. ".repeat(170),
  },
  { label: "Paragraphs with **bold**", src: generateParagraphs(10) },
  { label: "Fenced code blocks", src: generateCode(10) },
  { label: "Mixed markdown", src: generateMixed(10) },
  { label: "Heavy inline: *a* **b** `c` [d](e)", src: "*a* **b** `c` [d](e) ~f~ ".repeat(400) },
];

const contentHeader = ["Content Type", "Chunks", "Total", "Per chunk (median)", "Throughput"];
const contentRows: Array<Array<string>> = [contentHeader];

for (const { label, src } of contentTypes) {
  const r = benchStreaming(
    label,
    (acc: string, state?: unknown) => streamdParse(acc, state as null),
    src,
    50,
    20,
    50,
  );
  contentRows.push([
    label,
    String(r.numChunks),
    fmtMs(r.totalMs),
    fmtMs(r.perChunkMedianMs),
    r.throughput.toFixed(1) + " MB/s",
  ]);
}

printTable(contentRows);

// ── Streaming: paragraph scaling ──────────────────────────────

console.log("\n=== Paragraph Scaling (single paragraph, 50B chunks) ===\n");
console.log("Shows O(N_para) inline re-parse cost as paragraph grows.\n");

const paraScaleHeader = ["Paragraph Size", "Chunks", "Total", "Per chunk (median)", "vs 1KB"];
const paraScaleRows: Array<Array<string>> = [paraScaleHeader];
let baselinePerChunk = 0;

for (const sizeKb of [1, 5, 10, 25, 50]) {
  // Single long paragraph with occasional bold markers
  const para = "Hello world this is text with **bold** and *italic* markers. "
    .repeat(Math.ceil((sizeKb * 1024) / 60))
    .slice(0, sizeKb * 1024);
  const r = benchStreaming(
    `${sizeKb}KB`,
    (acc: string, state?: unknown) => streamdParse(acc, state as null),
    para,
    50,
    10,
    30,
  );
  if (sizeKb === 1) baselinePerChunk = r.perChunkMedianMs;
  const ratio =
    baselinePerChunk > 0 ? (r.perChunkMedianMs / baselinePerChunk).toFixed(1) + "x" : "1.0x";
  paraScaleRows.push([
    `${sizeKb} KB paragraph`,
    String(r.numChunks),
    fmtMs(r.totalMs),
    fmtMs(r.perChunkMedianMs),
    ratio,
  ]);
}

printTable(paraScaleRows);
console.log(
  "\nIf per-chunk time scales linearly with paragraph size, inline re-parse is the bottleneck.",
);
console.log("If it stays flat, fast paths are handling it.\n");
