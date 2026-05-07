/**
 * Unified benchmark suite for @streamd/parser.
 *
 * Compares @streamd/parser against marked, markdown-it, and commonmark.js
 * across static and streaming workloads.
 *
 * Streaming benchmark: all parsers receive the same accumulated source string
 * on each chunk. @streamd uses incremental state; others re-parse from scratch.
 *
 * Usage: `npx tsx packages/bench/src/index.ts`
 *
 * @module bench/index
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as streamdParse } from "@streamd/parser";
import { formatMs, printTable } from "./format";
import { generateMixed } from "./generate";
import { bench } from "./runner";
import type { MeasurementResult, ParserBenchTarget, StaticInput, StreamResult } from "./types";

/** Resolved directory of this module — used to locate fixture files. */
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Real-world markdown fixture loaded from disk for representative benchmarking. */
const sampleMarkdown = readFileSync(resolve(__dirname, "../fixtures/sample.md"), "utf8");

/** Static-parse inputs covering synthetic sizes, real-world content, and pathological patterns. */
const inputs: ReadonlyArray<StaticInput> = [
  { label: "Synthetic 1 KB", source: generateMixed(1), warmup: 200, iterations: 2000 },
  { label: "Synthetic 50 KB", source: generateMixed(50), warmup: 100, iterations: 500 },
  { label: "Synthetic 500 KB", source: generateMixed(500), warmup: 20, iterations: 100 },
  {
    label: `Real-world ${(sampleMarkdown.length / 1024).toFixed(1)} KB`,
    source: sampleMarkdown,
    warmup: 200,
    iterations: 2000,
  },
  { label: "Pathological *x10000", source: "*".repeat(10000), warmup: 100, iterations: 1000 },
  { label: "Pathological >x200", source: `${"> ".repeat(200)}text`, warmup: 100, iterations: 1000 },
];

/**
 * Parse the full accumulated source on each chunk boundary (fair comparison).
 *
 * @param name - Parser name for the result row.
 * @param parseFn - Streaming parse function receiving accumulated source and state.
 * @param source - Full source to chunk.
 * @param chunkSize - Byte length of each chunk.
 * @param warmup - Number of discarded warmup iterations.
 * @param iterations - Number of timed iterations.
 * @returns Streaming benchmark result with median timings and throughput.
 */
function benchStreamingFair(
  name: string,
  parseFn: (accumulated: string, state: unknown) => unknown,
  source: string,
  chunkSize: number,
  warmup: number,
  iterations: number,
): StreamResult {
  const boundaries = computeBoundaries(source.length, chunkSize);

  runWarmup(source, parseFn, boundaries, warmup);
  const { chunkTimes, totalTimes } = runMeasured(source, parseFn, boundaries, iterations);

  chunkTimes.sort((a, b) => a - b);
  totalTimes.sort((a, b) => a - b);
  const totalMedianMs = totalTimes[Math.floor(totalTimes.length / 2)] ?? 0;
  const perChunkMedianMs = chunkTimes[Math.floor(chunkTimes.length / 2)] ?? 0;
  const throughput = source.length / 1024 / 1024 / (totalMedianMs / 1000);

  return { name, numChunks: boundaries.length, totalMedianMs, perChunkMedianMs, throughput };
}

/**
 * Pre-compute cumulative byte boundaries for chunking.
 *
 * @param srcLength - Total source length in bytes.
 * @param chunkSize - Byte step between boundaries.
 * @returns Array of cumulative byte offsets ending with `srcLength`.
 */
function computeBoundaries(srcLength: number, chunkSize: number): ReadonlyArray<number> {
  const boundaries: Array<number> = [];
  for (let i = chunkSize; i < srcLength; i += chunkSize) boundaries.push(i);
  boundaries.push(srcLength);
  return boundaries;
}

/**
 * Warm-up without recording timings.
 *
 * @param source - Full source string.
 * @param parseFn - Streaming parse function.
 * @param boundaries - Cumulative byte boundaries.
 * @param warmup - Number of warmup passes.
 */
function runWarmup(
  source: string,
  parseFn: (accumulated: string, state: unknown) => unknown,
  boundaries: ReadonlyArray<number>,
  warmup: number,
): void {
  for (let w = 0; w < warmup; w++) {
    let state: unknown = null;
    for (let c = 0; c < boundaries.length; c++) {
      state = parseFn(source.slice(0, boundaries[c] ?? source.length), state);
    }
  }
}

/**
 * Measured iterations, returning per-chunk and total timings.
 *
 * @param source - Full source string.
 * @param parseFn - Streaming parse function.
 * @param boundaries - Cumulative byte boundaries.
 * @param iterations - Number of timed iterations.
 * @returns Per-chunk and total timing arrays in milliseconds.
 */
function runMeasured(
  source: string,
  parseFn: (accumulated: string, state: unknown) => unknown,
  boundaries: ReadonlyArray<number>,
  iterations: number,
): MeasurementResult {
  const chunkTimes: Array<number> = [];
  const totalTimes: Array<number> = [];

  for (let iter = 0; iter < iterations; iter++) {
    const totalStart = performance.now();
    let state: unknown = null;
    for (let c = 0; c < boundaries.length; c++) {
      const accumulated = source.slice(0, boundaries[c] ?? source.length);
      const chunkStart = performance.now();
      state = parseFn(accumulated, state);
      chunkTimes.push(performance.now() - chunkStart);
    }
    totalTimes.push(performance.now() - totalStart);
  }

  return { chunkTimes, totalTimes };
}

await runBench();

/** Orchestrates the three benchmark sections. */
async function runBench(): Promise<void> {
  const { marked } = await import("marked");
  const MarkdownIt = (await import("markdown-it")).default;
  const { Parser: CmParser } = await import("commonmark");
  const md = new MarkdownIt();
  const cmParser = new CmParser();

  const allParsers: ReadonlyArray<ParserBenchTarget> = [
    { name: "@streamd/parser", fn: (s) => streamdParse(s) },
    { name: "marked", fn: (s) => marked.lexer(s) },
    { name: "markdown-it", fn: (s) => md.parse(s, {}) },
    { name: "commonmark.js", fn: (s) => cmParser.parse(s) },
  ];

  printStaticSection(allParsers);
  printStreamingSection(marked, md, cmParser);
  printChunkSizeSection();
}

/**
 * Print the static-parse comparison.
 *
 * @param parsers - Array of parser targets to compare.
 */
function printStaticSection(parsers: ReadonlyArray<ParserBenchTarget>): void {
  console.log("=== Static Parse ===\n");

  const rows: Array<Array<string>> = [["Input", ...parsers.map((p) => p.name)]];
  for (const input of inputs) {
    const cells: Array<string> = [input.label];
    for (const parser of parsers) {
      const result = bench(parser.name, parser.fn, input.source, input.warmup, input.iterations);
      cells.push(`${formatMs(result.median)} / ${result.throughput.toFixed(0)} MB/s`);
    }
    rows.push(cells);
  }

  printTable(rows);
}

/**
 * Print the streaming-simulation section.
 *
 * @param marked - The marked lexer instance.
 * @param md - The markdown-it instance.
 * @param cmParser - The commonmark.js parser instance.
 */
function printStreamingSection(
  marked: typeof import("marked")["marked"],
  md: InstanceType<typeof import("markdown-it")["default"]>,
  cmParser: InstanceType<typeof import("commonmark")["Parser"]>,
): void {
  console.log("\n=== Streaming Simulation (50 KB, 200B chunks) ===\n");
  console.log("All parsers receive the same accumulated source string on each chunk.");
  console.log("@streamd uses incremental state; others re-parse from scratch.\n");

  const streamSource = generateMixed(50);
  const streamParsers: ReadonlyArray<{
    readonly name: string;
    readonly fn: (accumulated: string, state: unknown) => unknown;
  }> = [
    {
      name: "@streamd/parser",
      fn: (accumulated, state) => streamdParse(accumulated, state as null).state,
    },
    {
      name: "marked",
      fn: (accumulated) => {
        marked.lexer(accumulated);
        return null;
      },
    },
    {
      name: "markdown-it",
      fn: (accumulated) => {
        md.parse(accumulated, {});
        return null;
      },
    },
    {
      name: "commonmark.js",
      fn: (accumulated) => {
        cmParser.parse(accumulated);
        return null;
      },
    },
  ];

  const rows: Array<Array<string>> = [
    ["Parser", "Chunks", "Total", "Per chunk (median)", "Throughput"],
  ];
  for (const parser of streamParsers) {
    const result = benchStreamingFair(parser.name, parser.fn, streamSource, 200, 10, 30);
    rows.push([
      parser.name,
      String(result.numChunks),
      formatMs(result.totalMedianMs),
      formatMs(result.perChunkMedianMs),
      `${result.throughput.toFixed(1)} MB/s`,
    ]);
  }

  const fullResult = bench("full", (s) => streamdParse(s), streamSource, 100, 500);
  rows.push([
    "@streamd (full parse)",
    "1",
    formatMs(fullResult.median),
    "\u2014",
    `${fullResult.throughput.toFixed(1)} MB/s`,
  ]);

  printTable(rows);
}

/** Print the per-chunk-size breakdown section. */
function printChunkSizeSection(): void {
  console.log("\n=== @streamd/parser Streaming by Chunk Size (50 KB) ===\n");

  const streamSource = generateMixed(50);
  const rows: Array<Array<string>> = [
    ["Chunk Size", "Chunks", "Total", "Per chunk (median)", "Throughput"],
  ];

  for (const chunkSize of [3, 10, 50, 200, 1000]) {
    const result = benchStreamingFair(
      `${chunkSize}B`,
      (accumulated, state) => streamdParse(accumulated, state as null).state,
      streamSource,
      chunkSize,
      10,
      30,
    );
    rows.push([
      `${chunkSize}B`,
      String(result.numChunks),
      formatMs(result.totalMedianMs),
      formatMs(result.perChunkMedianMs),
      `${result.throughput.toFixed(1)} MB/s`,
    ]);
  }

  printTable(rows);
}
