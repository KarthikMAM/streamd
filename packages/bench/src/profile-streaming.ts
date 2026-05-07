/**
 * Profile streaming paths — identifies where time is spent per chunk.
 *
 * Usage: `npx tsx packages/bench/src/profile-streaming.ts`
 *
 * @module bench/profile-streaming
 */
import { parse as streamdParse } from "@streamd/parser";
import { formatNs, printTable } from "./format";
import { generateMixed } from "./generate";
import type { ProfileResult } from "./types";

/** Nanoseconds per millisecond — conversion factor for `performance.now()` deltas. */
const NS_PER_MS = 1_000_000;

/**
 * Measure the per-chunk cost of streaming parsing.
 *
 * @param label - Human-readable scenario name for the output row.
 * @param source - Full source to split into chunks.
 * @param chunkSize - Byte length of each chunk.
 * @param warmup - Warm-up iterations (not measured).
 * @param iterations - Measured iterations.
 * @returns Summary with median, p99, min and max chunk times in ns.
 */
function profileStreaming(
  label: string,
  source: string,
  chunkSize: number,
  warmup: number,
  iterations: number,
): ProfileResult {
  const chunks = chunkSource(source, chunkSize);

  warmupRun(chunks, warmup);
  const samples = measureRun(chunks, iterations);
  samples.sort((a, b) => a - b);

  return {
    label,
    totalChunks: chunks.length,
    medianNs: samples[Math.floor(samples.length / 2)] ?? 0,
    p99Ns: samples[Math.floor(samples.length * 0.99)] ?? 0,
    minNs: samples[0] ?? 0,
    maxNs: samples[samples.length - 1] ?? 0,
  };
}

/**
 * Split the source into equal-sized chunks.
 *
 * @param source - Full source string.
 * @param chunkSize - Byte length of each chunk.
 * @returns Array of chunk strings.
 */
function chunkSource(source: string, chunkSize: number): ReadonlyArray<string> {
  const chunks: Array<string> = [];
  for (let i = 0; i < source.length; i += chunkSize) {
    chunks.push(source.slice(i, Math.min(i + chunkSize, source.length)));
  }
  return chunks;
}

/**
 * Run the stream `warmup` times without recording timings.
 *
 * @param chunks - Pre-split source chunks.
 * @param warmup - Number of warmup passes.
 */
function warmupRun(chunks: ReadonlyArray<string>, warmup: number): void {
  for (let w = 0; w < warmup; w++) streamThrough(chunks);
}

/**
 * Run the stream `iterations` times, returning per-chunk times in ns.
 *
 * @param chunks - Pre-split source chunks.
 * @param iterations - Number of measured passes.
 * @returns Flat array of per-chunk nanosecond timings across all iterations.
 */
function measureRun(chunks: ReadonlyArray<string>, iterations: number): Array<number> {
  const times: Array<number> = [];
  for (let iter = 0; iter < iterations; iter++) {
    times.push(...streamThroughMeasured(chunks));
  }
  return times;
}

/**
 * Parse a full stream once without timings.
 *
 * @param chunks - Pre-split source chunks.
 */
function streamThrough(chunks: ReadonlyArray<string>): void {
  let state: ReturnType<typeof streamdParse>["state"] | null = null;
  let accumulated = "";
  for (let c = 0; c < chunks.length; c++) {
    accumulated += chunks[c] ?? "";
    const result = streamdParse(accumulated, state as null);
    state = result.state;
  }
}

/**
 * Parse a stream once and return the per-chunk time in nanoseconds.
 *
 * @param chunks - Pre-split source chunks.
 * @returns Array of per-chunk nanosecond timings for this pass.
 */
function streamThroughMeasured(chunks: ReadonlyArray<string>): Array<number> {
  const perChunk: Array<number> = [];
  let state: ReturnType<typeof streamdParse>["state"] | null = null;
  let accumulated = "";
  for (let c = 0; c < chunks.length; c++) {
    accumulated += chunks[c] ?? "";
    const start = performance.now();
    const result = streamdParse(accumulated, state as null);
    state = result.state;
    perChunk.push((performance.now() - start) * NS_PER_MS);
  }
  return perChunk;
}

/**
 * Print the set of profile results as a markdown-style table.
 *
 * @param results - Array of profile results to render.
 */
function printResults(results: ReadonlyArray<ProfileResult>): void {
  const rows: Array<Array<string>> = [["Scenario", "Chunks", "Median", "p99", "Min", "Max"]];
  for (const result of results) {
    rows.push([
      result.label,
      String(result.totalChunks),
      formatNs(result.medianNs),
      formatNs(result.p99Ns),
      formatNs(result.minNs),
      formatNs(result.maxNs),
    ]);
  }
  printTable(rows);
}

runTextAppendSection();
runFencedCodeSection();
runParagraphInlineSection();
runMixedSection();
runNewlineParagraphSection();
runConcatTokensSection();

/** Section: text-append fast path. */
function runTextAppendSection(): void {
  console.log("=== Text-Append Fast Path (pure words, no newlines) ===\n");
  const plainText =
    "The quick brown fox jumps over the lazy dog and keeps running forever. ".repeat(150);
  printResults([
    profileStreaming("3B chunks", plainText, 3, 20, 50),
    profileStreaming("10B chunks", plainText, 10, 20, 50),
    profileStreaming("50B chunks", plainText, 50, 20, 50),
  ]);
}

/** Section: fenced-code fast path. */
function runFencedCodeSection(): void {
  console.log("\n=== Fenced Code Fast Path ===\n");
  const codeBlock = `\`\`\`js\n${"const x = 1;\n".repeat(800)}\`\`\`\n`;
  printResults([
    profileStreaming("3B chunks", codeBlock, 3, 20, 50),
    profileStreaming("10B chunks", codeBlock, 10, 20, 50),
    profileStreaming("50B chunks", codeBlock, 50, 20, 50),
  ]);
}

/** Section: paragraph inline re-parse scaling. */
function runParagraphInlineSection(): void {
  console.log("\n=== Paragraph with Inline Formatting (re-parse path) ===\n");
  const boldPara = "This is text with **bold** and *italic* markers. ".repeat(200);
  printResults([
    profileStreaming("1KB para, 50B", boldPara.slice(0, 1024), 50, 20, 100),
    profileStreaming("5KB para, 50B", boldPara.slice(0, 5120), 50, 20, 50),
    profileStreaming("10KB para, 50B", boldPara.slice(0, 10240), 50, 20, 30),
  ]);
}

/** Section: mixed markdown (all fast paths active). */
function runMixedSection(): void {
  console.log("\n=== Mixed Markdown (all fast paths) ===\n");
  printResults([
    profileStreaming("1KB mixed, 3B", generateMixed(1), 3, 20, 100),
    profileStreaming("10KB mixed, 50B", generateMixed(10), 50, 20, 50),
    profileStreaming("50KB mixed, 50B", generateMixed(50), 50, 20, 30),
  ]);
}

/** Section: many softbreaks inside one paragraph. */
function runNewlineParagraphSection(): void {
  console.log("\n=== Paragraph with Newlines (softbreak tokens) ===\n");
  const newlineParagraph = "Line of text here\n".repeat(600);
  printResults([
    profileStreaming("10KB, 50B chunks", newlineParagraph.slice(0, 10240), 50, 20, 50),
  ]);
}

/** Section: scaling after many completed blocks (concat overhead). */
function runConcatTokensSection(): void {
  console.log("\n=== After Many Completed Blocks (concatTokens scaling) ===\n");
  const manyBlocks = `${"# H\n\n".repeat(200)}Streaming paragraph `;
  const manyBlocksSource = `${manyBlocks}${"word ".repeat(100)}`;
  printResults([profileStreaming("200 completed + para, 5B", manyBlocksSource, 5, 10, 50)]);
}
