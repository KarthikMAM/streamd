/**
 * Baseline benchmark — captures static and streaming performance.
 *
 * Run before and after changes to verify zero static regression and measure
 * streaming improvements.
 *
 * Usage: `npx tsx packages/bench/src/baseline.ts`
 *
 * @module bench/baseline
 */
import { parse as streamdParse } from "@streamd/parser";
import { formatMs, printTable } from "./format";
import { generateCode, generateMixed, generateParagraphs } from "./generate";
import { bench, benchStreaming } from "./runner";
import type { StaticInput } from "./types";

/** Static-parse cases covering mixed, paragraph-heavy, code-heavy, and pathological inputs. */
const staticCases: ReadonlyArray<StaticInput> = [
  { label: "Mixed 1 KB", source: generateMixed(1), warmup: 500, iterations: 5000 },
  { label: "Mixed 10 KB", source: generateMixed(10), warmup: 200, iterations: 2000 },
  { label: "Mixed 50 KB", source: generateMixed(50), warmup: 100, iterations: 500 },
  { label: "Mixed 500 KB", source: generateMixed(500), warmup: 20, iterations: 100 },
  { label: "Paragraphs 50 KB", source: generateParagraphs(50), warmup: 100, iterations: 500 },
  { label: "Code blocks 50 KB", source: generateCode(50), warmup: 100, iterations: 500 },
  { label: "Pathological * x10000", source: "*".repeat(10000), warmup: 200, iterations: 2000 },
  {
    label: "Pathological > x200",
    source: `${"> ".repeat(200)}text`,
    warmup: 200,
    iterations: 2000,
  },
];

runStaticSection();
runStreamingFastPathSection();
runContentTypeSection();
runParagraphScalingSection();

/** Print the static-parse throughput section. */
function runStaticSection(): void {
  console.log("=== Static Parse (@streamd/parser only) ===\n");

  const rows: Array<Array<string>> = [["Input", "Median", "p95", "Throughput"]];
  for (const testCase of staticCases) {
    const result = bench(
      testCase.label,
      (input) => streamdParse(input),
      testCase.source,
      testCase.warmup,
      testCase.iterations,
    );
    rows.push([
      testCase.label,
      formatMs(result.median),
      formatMs(result.p95),
      `${result.throughput.toFixed(1)} MB/s`,
    ]);
  }

  printTable(rows);
}

/** Print the streaming fast-path breakdown section. */
function runStreamingFastPathSection(): void {
  console.log("\n=== Streaming Fast-Path Breakdown (50 KB mixed) ===\n");
  console.log("Each row simulates LLM streaming at different chunk sizes.\n");

  const streamSource = generateMixed(50);
  const rows: Array<Array<string>> = [
    ["Scenario", "Chunks", "Total", "Per chunk (median)", "Throughput"],
  ];

  for (const chunkSize of [3, 10, 50, 200, 1000]) {
    rows.push(benchRowForStreaming(streamSource, chunkSize));
  }
  rows.push(fullParseRowFor(streamSource));

  printTable(rows);
}

/**
 * Build a row for `benchStreaming` at a given chunk size.
 *
 * @param source - Full markdown source to stream.
 * @param chunkSize - Byte length of each chunk.
 * @returns Array of cell strings for the table row.
 */
function benchRowForStreaming(source: string, chunkSize: number): Array<string> {
  const result = benchStreaming(
    `${chunkSize}B chunks`,
    (accumulated, state) => streamdParse(accumulated, state as null),
    source,
    chunkSize,
    20,
    50,
  );
  return [
    `Mixed ${chunkSize}B chunks`,
    String(result.numChunks),
    formatMs(result.totalMs),
    formatMs(result.perChunkMedianMs),
    `${result.throughput.toFixed(1)} MB/s`,
  ];
}

/**
 * Build the full-parse reference row for the streaming section.
 *
 * @param source - Full markdown source to parse in one shot.
 * @returns Array of cell strings for the table row.
 */
function fullParseRowFor(source: string): Array<string> {
  const result = bench("full", (input) => streamdParse(input), source, 100, 500);
  return [
    "Full parse (no streaming)",
    "1",
    formatMs(result.median),
    "\u2014",
    `${result.throughput.toFixed(1)} MB/s`,
  ];
}

/** Print the content-type breakdown section. */
function runContentTypeSection(): void {
  console.log("\n=== Streaming by Content Type (10 KB, 50B chunks) ===\n");
  console.log("Tests which fast paths fire for different content.\n");

  const samples: ReadonlyArray<{ readonly label: string; readonly source: string }> = [
    {
      label: "Plain text (no special chars)",
      source: "The quick brown fox jumps over the lazy dog and keeps running. ".repeat(170),
    },
    { label: "Paragraphs with **bold**", source: generateParagraphs(10) },
    { label: "Fenced code blocks", source: generateCode(10) },
    { label: "Mixed markdown", source: generateMixed(10) },
    {
      label: "Heavy inline: *a* **b** `c` [d](e)",
      source: "*a* **b** `c` [d](e) ~f~ ".repeat(400),
    },
  ];

  const rows: Array<Array<string>> = [
    ["Content Type", "Chunks", "Total", "Per chunk (median)", "Throughput"],
  ];
  for (const sample of samples) {
    const result = benchStreaming(
      sample.label,
      (accumulated, state) => streamdParse(accumulated, state as null),
      sample.source,
      50,
      20,
      50,
    );
    rows.push([
      sample.label,
      String(result.numChunks),
      formatMs(result.totalMs),
      formatMs(result.perChunkMedianMs),
      `${result.throughput.toFixed(1)} MB/s`,
    ]);
  }

  printTable(rows);
}

/** Print the paragraph-scaling section (shows O(N) inline re-parse cost). */
function runParagraphScalingSection(): void {
  console.log("\n=== Paragraph Scaling (single paragraph, 50B chunks) ===\n");
  console.log("Shows O(N_para) inline re-parse cost as paragraph grows.\n");

  const rows: Array<Array<string>> = [
    ["Paragraph Size", "Chunks", "Total", "Per chunk (median)", "vs 1KB"],
  ];
  let baselinePerChunk = 0;

  for (const sizeKb of [1, 5, 10, 25, 50]) {
    const paragraph = buildParagraph(sizeKb);
    const result = benchStreaming(
      `${sizeKb}KB`,
      (accumulated, state) => streamdParse(accumulated, state as null),
      paragraph,
      50,
      10,
      30,
    );
    if (sizeKb === 1) baselinePerChunk = result.perChunkMedianMs;
    const ratio =
      baselinePerChunk > 0 ? `${(result.perChunkMedianMs / baselinePerChunk).toFixed(1)}x` : "1.0x";
    rows.push([
      `${sizeKb} KB paragraph`,
      String(result.numChunks),
      formatMs(result.totalMs),
      formatMs(result.perChunkMedianMs),
      ratio,
    ]);
  }

  printTable(rows);
  console.log(
    "\nIf per-chunk time scales linearly with paragraph size, inline re-parse is the bottleneck.",
  );
  console.log("If it stays flat, fast paths are handling it.\n");
}

/**
 * Build a single paragraph of approximately `sizeKb` kilobytes with bold markers.
 *
 * @param sizeKb - Target size in kilobytes.
 * @returns A single paragraph string with inline formatting.
 */
function buildParagraph(sizeKb: number): string {
  const template = "Hello world this is text with **bold** and *italic* markers. ";
  const bytesTarget = sizeKb * 1024;
  const repetitions = Math.ceil(bytesTarget / template.length);
  return template.repeat(repetitions).slice(0, bytesTarget);
}
