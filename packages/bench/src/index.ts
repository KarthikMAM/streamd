/**
 * Unified benchmark suite for @streamd/parser.
 *
 * Compares @streamd/parser against marked, markdown-it, and commonmark.js
 * across static and streaming workloads.
 *
 * Streaming benchmark: all parsers receive the same accumulated source string
 * on each chunk. @streamd uses incremental state; others re-parse from scratch.
 * This is the fair comparison — same input, different strategies.
 *
 * Usage: npx tsx packages/bench/src/index.ts
 *
 * @module bench/index
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as streamdParse } from "@streamd/parser";
import { generateMixed } from "./generate";
import { bench } from "./runner";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleMd = readFileSync(resolve(__dirname, "../fixtures/sample.md"), "utf8");

const inputs = [
  { label: "Synthetic 1 KB", src: generateMixed(1), warmup: 200, iter: 2000 },
  { label: "Synthetic 50 KB", src: generateMixed(50), warmup: 100, iter: 500 },
  { label: "Synthetic 500 KB", src: generateMixed(500), warmup: 20, iter: 100 },
  {
    label: `Real-world ${(sampleMd.length / 1024).toFixed(1)} KB`,
    src: sampleMd,
    warmup: 200,
    iter: 2000,
  },
  { label: "Pathological *x10000", src: "*".repeat(10000), warmup: 100, iter: 1000 },
  { label: "Pathological >x200", src: "> ".repeat(200) + "text", warmup: 100, iter: 1000 },
];

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

/** Result of a streaming benchmark. */
interface StreamResult {
  name: string;
  numChunks: number;
  totalMedianMs: number;
  perChunkMedianMs: number;
  throughput: number;
}

/**
 * Benchmark streaming parse — all parsers receive the same accumulated string.
 *
 * Simulates LLM streaming: source arrives in chunks of `chunkSize` bytes.
 * On each chunk, the parser receives the full accumulated source so far.
 * @streamd uses state for incremental parsing; others re-parse from scratch.
 */
function benchStreamingFair(
  name: string,
  parseFn: (accumulated: string, state: unknown) => unknown,
  src: string,
  chunkSize: number,
  warmup: number,
  iterations: number,
): StreamResult {
  // Pre-compute chunk boundaries
  const boundaries: Array<number> = [];
  for (let i = chunkSize; i < src.length; i += chunkSize) boundaries.push(i);
  boundaries.push(src.length);
  const numChunks = boundaries.length;

  // Warmup
  for (let w = 0; w < warmup; w++) {
    let state: unknown = null;
    for (let c = 0; c < numChunks; c++) {
      state = parseFn(src.slice(0, boundaries[c]!), state);
    }
  }

  // Measure
  const chunkTimes: Array<number> = [];
  const totalTimes: Array<number> = [];

  for (let iter = 0; iter < iterations; iter++) {
    const totalStart = performance.now();
    let state: unknown = null;
    for (let c = 0; c < numChunks; c++) {
      const accumulated = src.slice(0, boundaries[c]!);
      const t0 = performance.now();
      state = parseFn(accumulated, state);
      chunkTimes.push(performance.now() - t0);
    }
    totalTimes.push(performance.now() - totalStart);
  }

  chunkTimes.sort((a, b) => a - b);
  totalTimes.sort((a, b) => a - b);

  const totalMedianMs = totalTimes[Math.floor(totalTimes.length / 2)]!;
  const perChunkMedianMs = chunkTimes[Math.floor(chunkTimes.length / 2)]!;
  const throughput = src.length / 1024 / 1024 / (totalMedianMs / 1000);

  return { name, numChunks, totalMedianMs, perChunkMedianMs, throughput };
}

async function main(): Promise<void> {
  const { marked } = await import("marked");
  const MarkdownIt = (await import("markdown-it")).default;
  const { Parser: CmParser } = await import("commonmark");
  const md = new MarkdownIt();
  const cmParser = new CmParser();

  const allParsers = [
    { name: "@streamd/parser", fn: (s: string) => streamdParse(s) },
    { name: "marked", fn: (s: string) => marked.lexer(s) },
    { name: "markdown-it", fn: (s: string) => md.parse(s, {}) },
    { name: "commonmark.js", fn: (s: string) => cmParser.parse(s) },
  ];

  // === Static parse ===
  console.log("=== Static Parse ===\n");

  const staticHeader = ["Input", ...allParsers.map((p) => p.name)];
  const staticRows: Array<Array<string>> = [staticHeader];

  for (const { label, src, warmup, iter } of inputs) {
    const cells = [label];
    for (const parser of allParsers) {
      const r = bench(parser.name, parser.fn, src, warmup, iter);
      cells.push(fmtMs(r.median) + " / " + r.throughput.toFixed(0) + " MB/s");
    }
    staticRows.push(cells);
  }

  printTable(staticRows);

  // === Streaming ===
  console.log("\n=== Streaming Simulation (50 KB, 200B chunks) ===\n");
  console.log("All parsers receive the same accumulated source string on each chunk.");
  console.log("@streamd uses incremental state; others re-parse from scratch.\n");

  const streamSrc = generateMixed(50);

  // Define streaming parsers — all receive (accumulated, state) → state
  const streamParsers = [
    {
      name: "@streamd/parser",
      fn: (acc: string, state: unknown) => streamdParse(acc, state as null).state,
    },
    {
      name: "marked",
      fn: (acc: string, _state: unknown) => {
        marked.lexer(acc);
        return null;
      },
    },
    {
      name: "markdown-it",
      fn: (acc: string, _state: unknown) => {
        md.parse(acc, {});
        return null;
      },
    },
    {
      name: "commonmark.js",
      fn: (acc: string, _state: unknown) => {
        cmParser.parse(acc);
        return null;
      },
    },
  ];

  const streamHeader = ["Parser", "Chunks", "Total", "Per chunk (median)", "Throughput"];
  const streamRows: Array<Array<string>> = [streamHeader];

  for (const p of streamParsers) {
    const r = benchStreamingFair(p.name, p.fn, streamSrc, 200, 10, 30);
    streamRows.push([
      p.name,
      String(r.numChunks),
      fmtMs(r.totalMedianMs),
      fmtMs(r.perChunkMedianMs),
      r.throughput.toFixed(1) + " MB/s",
    ]);
  }

  // Add full parse reference
  const fullR = bench("full", (s) => streamdParse(s), streamSrc, 100, 500);
  streamRows.push([
    "@streamd (full parse)",
    "1",
    fmtMs(fullR.median),
    "\u2014",
    fullR.throughput.toFixed(1) + " MB/s",
  ]);

  printTable(streamRows);

  // === Streaming at different chunk sizes (streamd only) ===
  console.log("\n=== @streamd/parser Streaming by Chunk Size (50 KB) ===\n");

  const csHeader = ["Chunk Size", "Chunks", "Total", "Per chunk (median)", "Throughput"];
  const csRows: Array<Array<string>> = [csHeader];

  for (const cs of [3, 10, 50, 200, 1000]) {
    const r = benchStreamingFair(
      cs + "B",
      (acc, state) => streamdParse(acc, state as null).state,
      streamSrc,
      cs,
      10,
      30,
    );
    csRows.push([
      cs + "B",
      String(r.numChunks),
      fmtMs(r.totalMedianMs),
      fmtMs(r.perChunkMedianMs),
      r.throughput.toFixed(1) + " MB/s",
    ]);
  }

  printTable(csRows);
}

main();
