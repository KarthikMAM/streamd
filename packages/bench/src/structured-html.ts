/**
 * HTML-renderer benchmarks captured in the structured baseline.
 *
 * The static section pre-parses tokens once per size tier and measures
 * only `renderHtml` throughput, isolating the renderer cost from parser
 * work. The streaming section measures per-chunk render cost when the
 * full accumulated token tree is re-rendered on every chunk — the
 * contract consumers of `streamHtml` see in practice.
 *
 * @module bench/structured-html
 */
import { renderHtml } from "@streamd/html";
import type { ParserState } from "@streamd/parser";
import { parse as streamdParse } from "@streamd/parser";
import { buildStaticRecord, measureLatency, snapshotHeap, throughputMbPerS } from "./bench-metrics";
import { generateMixed } from "./generate";
import type { BenchmarkRecord } from "./schema";
import type { RendererStaticCase, RendererStreamingCase } from "./types";

/** Static HTML-render sizes: 1 KB / 10 KB / 50 KB / 500 KB per task spec. */
function staticCases(): ReadonlyArray<RendererStaticCase> {
  return [
    {
      id: "html.static.mixed-1kb",
      label: "HTML render 1 KB",
      sizeKb: 1,
      warmup: 300,
      iterations: 1000,
    },
    {
      id: "html.static.mixed-10kb",
      label: "HTML render 10 KB",
      sizeKb: 10,
      warmup: 150,
      iterations: 500,
    },
    {
      id: "html.static.mixed-50kb",
      label: "HTML render 50 KB",
      sizeKb: 50,
      warmup: 50,
      iterations: 200,
    },
    {
      id: "html.static.mixed-500kb",
      label: "HTML render 500 KB",
      sizeKb: 500,
      warmup: 10,
      iterations: 30,
    },
  ];
}

/**
 * Run the static HTML-render section — pre-parses tokens, times render only.
 *
 * @returns Array of benchmark records for the static HTML cases.
 */
export function runHtmlStaticBenches(): Array<BenchmarkRecord> {
  const records: Array<BenchmarkRecord> = [];
  for (const testCase of staticCases()) records.push(runSingleStatic(testCase));
  return records;
}

/**
 * Run one static case: parse once, measure render through warmup + iterations.
 *
 * @param testCase - Static case configuration.
 * @returns A single benchmark record.
 */
function runSingleStatic(testCase: RendererStaticCase): BenchmarkRecord {
  const source = generateMixed(testCase.sizeKb);
  const tokens = streamdParse(source, null).tokens;
  const before = snapshotHeap();
  const stats = measureLatency(() => renderHtml(tokens), testCase.warmup, testCase.iterations);
  const after = snapshotHeap();

  return buildStaticRecord({
    id: testCase.id,
    label: testCase.label,
    kind: "html-static",
    inputBytes: source.length,
    stats,
    heapUsedBytes: Math.max(0, after - before),
  });
}

/**
 * Run the streaming HTML-render section — 50 KB source, 50-byte chunks, per-chunk timings.
 *
 * @returns Array containing the single streaming HTML benchmark record.
 */
export function runHtmlStreamingBenches(): Array<BenchmarkRecord> {
  const record = runStreamingCase({
    id: "html.streaming.mixed-50kb.chunk-50",
    label: "HTML streaming 50 KB / 50B chunks",
    sizeKb: 50,
    chunkSize: 50,
    warmup: 5,
    iterations: 15,
  });
  return [record];
}

/**
 * Run one streaming case: feed source incrementally, render each accumulated token tree.
 *
 * @param testCase - Streaming case configuration.
 * @returns A single benchmark record with per-chunk and total timings.
 */
function runStreamingCase(testCase: RendererStreamingCase): BenchmarkRecord {
  const source = generateMixed(testCase.sizeKb);
  const boundaries = computeBoundaries(source.length, testCase.chunkSize);

  runStreamingWarmup(source, boundaries, testCase.warmup);
  const before = snapshotHeap();
  const { perChunkMs, totalMs } = collectStreamingSamples(source, boundaries, testCase.iterations);
  const after = snapshotHeap();

  return assembleStreamingRecord(
    testCase,
    source.length,
    boundaries.length,
    perChunkMs,
    totalMs,
    after - before,
  );
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
 * Warm-up pass — no timings recorded. Lets V8 JIT the render path.
 *
 * @param source - Full source string.
 * @param boundaries - Cumulative byte boundaries.
 * @param warmup - Number of warmup passes.
 */
function runStreamingWarmup(
  source: string,
  boundaries: ReadonlyArray<number>,
  warmup: number,
): void {
  for (let w = 0; w < warmup; w++) streamOnce(source, boundaries, null);
}

/**
 * Measurement pass — collects per-chunk and per-iteration totals in ms.
 *
 * @param source - Full source string.
 * @param boundaries - Cumulative byte boundaries.
 * @param iterations - Number of measured passes.
 * @returns Per-chunk and total timing arrays.
 */
function collectStreamingSamples(
  source: string,
  boundaries: ReadonlyArray<number>,
  iterations: number,
): { readonly perChunkMs: Array<number>; readonly totalMs: Array<number> } {
  const perChunkMs: Array<number> = [];
  const totalMs: Array<number> = [];

  for (let iter = 0; iter < iterations; iter++) {
    const start = performance.now();
    streamOnce(source, boundaries, perChunkMs);
    totalMs.push(performance.now() - start);
  }

  return { perChunkMs, totalMs };
}

/**
 * Single streaming pass through the source. When `perChunkOut` is
 * provided each chunk's render latency is pushed into it; when null the
 * call is a warmup-only pass.
 *
 * @param source - Full source string.
 * @param boundaries - Cumulative byte boundaries.
 * @param perChunkOut - Output array for per-chunk timings, or null for warmup.
 */
function streamOnce(
  source: string,
  boundaries: ReadonlyArray<number>,
  perChunkOut: Array<number> | null,
): void {
  let state: ParserState | null = null;
  for (let c = 0; c < boundaries.length; c++) {
    const accumulated = source.slice(0, boundaries[c] ?? source.length);
    const chunkStart = perChunkOut === null ? 0 : performance.now();
    const result = streamdParse(accumulated, state);
    state = result.state;
    renderHtml(result.tokens);
    if (perChunkOut !== null) perChunkOut.push(performance.now() - chunkStart);
  }
}

/**
 * Compose the streaming record from collected samples.
 *
 * @param testCase - Streaming case configuration.
 * @param inputBytes - Total source size in bytes.
 * @param numChunks - Number of chunk boundaries.
 * @param perChunkMs - Per-chunk timing samples in ms.
 * @param totalMs - Per-iteration total timing samples in ms.
 * @param heapDeltaBytes - Heap growth during measurement.
 * @returns Assembled benchmark record.
 */
function assembleStreamingRecord(
  testCase: RendererStreamingCase,
  inputBytes: number,
  numChunks: number,
  perChunkMs: Array<number>,
  totalMs: Array<number>,
  heapDeltaBytes: number,
): BenchmarkRecord {
  perChunkMs.sort((a, b) => a - b);
  totalMs.sort((a, b) => a - b);

  const perChunkMedianMs = perChunkMs[Math.floor(perChunkMs.length / 2)] ?? 0;
  const perChunkP99Ms = perChunkMs[Math.floor(perChunkMs.length * 0.99)] ?? 0;
  const totalMedianMs = totalMs[Math.floor(totalMs.length / 2)] ?? 0;
  const totalP99Ms = totalMs[Math.floor(totalMs.length * 0.99)] ?? 0;

  return {
    id: testCase.id,
    label: testCase.label,
    kind: "html-streaming",
    inputBytes,
    medianMs: totalMedianMs,
    p95Ms: totalP99Ms,
    p99Ms: totalP99Ms,
    throughputMbPerS: throughputMbPerS(inputBytes, totalMedianMs),
    perChunkMedianMs,
    perChunkP99Ms,
    numChunks,
    heapUsedBytes: Math.max(0, heapDeltaBytes),
  };
}
