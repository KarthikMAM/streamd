/**
 * Renderer benchmarks — measures the cost of each renderer in the
 * streamd stack (html, react server-render).
 *
 * Usage: `npx tsx packages/bench/src/renderers.ts`
 *
 * @module bench/renderers
 */
import { renderHtml } from "@streamd/html";
import { type ParserState, parse } from "@streamd/parser";
import { renderReact } from "@streamd/react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatMs, padEnd, padStart } from "./format";
import { generateMixed } from "./generate";
import { bench } from "./runner";
import type { ChunkCost, SizedInput } from "./types";

/** Size tiers for renderer throughput measurement: 1 KB / 10 KB / 50 KB / 200 KB. */
const sizes: ReadonlyArray<SizedInput> = [
  { label: "1 KB", source: generateMixed(1) },
  { label: "10 KB", source: generateMixed(10) },
  { label: "50 KB", source: generateMixed(50) },
  { label: "200 KB", source: generateMixed(200) },
];

runRenderOnlySection();
runFullPipelineSection();
runStreamingSection();

/** Print render-only throughput with the tokens pre-parsed. */
function runRenderOnlySection(): void {
  console.log("=== Renderer Throughput (tokens already parsed) ===\n");
  console.log(padEnd("Input", 10), padStart("html", 14), padStart("react SSR", 14));

  for (const input of sizes) {
    const tokens = parse(input.source, null, { gfm: true }).tokens;
    const htmlResult = bench("html", () => renderHtml(tokens), "x", 200, 500);
    const reactResult = bench(
      "react",
      () => renderToStaticMarkup(renderReact(tokens) as ReactNode),
      "x",
      20,
      60,
    );
    const byteSize = input.source.length;
    const htmlMb = throughputMb(byteSize, htmlResult.median);
    const reactMb = throughputMb(byteSize, reactResult.median);
    console.log(
      padEnd(input.label, 10),
      padStart(`${formatMs(htmlResult.median)} / ${htmlMb.toFixed(0)} MB/s`, 14),
      padStart(`${formatMs(reactResult.median)} / ${reactMb.toFixed(0)} MB/s`, 14),
    );
  }
}

/** Print full pipeline: parse + render for the three renderers. */
function runFullPipelineSection(): void {
  console.log("\n=== Full pipeline: parse + render ===\n");
  console.log(padEnd("Input", 10), padStart("parse+html", 18), padStart("parse+react", 18));

  for (const input of sizes) {
    const htmlResult = bench(
      "html",
      () => renderHtml(parse(input.source, null, { gfm: true }).tokens),
      "x",
      100,
      300,
    );
    const reactResult = bench(
      "react",
      () =>
        renderToStaticMarkup(
          renderReact(parse(input.source, null, { gfm: true }).tokens) as ReactNode,
        ),
      "x",
      10,
      30,
    );
    const byteSize = input.source.length;
    console.log(
      padEnd(input.label, 10),
      padStart(
        `${formatMs(htmlResult.median)} / ${throughputMb(byteSize, htmlResult.median).toFixed(0)} MB/s`,
        18,
      ),
      padStart(
        `${formatMs(reactResult.median)} / ${throughputMb(byteSize, reactResult.median).toFixed(0)} MB/s`,
        18,
      ),
    );
  }
}

/** Print streaming per-chunk render cost comparison. */
function runStreamingSection(): void {
  console.log("\n=== Streaming: per-chunk render cost (50 KB, 50 B chunks) ===\n");

  const streamSource = generateMixed(50);
  const htmlStream = streamingChunkCost(streamSource, 50, (tokens) => renderHtml(tokens), 15);
  console.log(
    padEnd("html", 14),
    `per-chunk median ${formatMs(htmlStream.perChunk)} (full-stream total ${formatMs(htmlStream.total)})`,
  );

  const reactStream = streamingChunkCost(
    streamSource,
    50,
    (tokens) => renderToStaticMarkup(renderReact(tokens) as ReactNode),
    15,
  );
  console.log(
    padEnd("react SSR", 14),
    `per-chunk median ${formatMs(reactStream.perChunk)} (full-stream total ${formatMs(reactStream.total)})`,
  );
}

/**
 * Simulate streaming at `chunkSize` bytes, timing each renderer invocation.
 *
 * @param source - Full markdown source to stream.
 * @param chunkSize - Byte length of each chunk.
 * @param renderFn - Renderer function to time on each chunk's token tree.
 * @param iterations - Number of full-stream passes.
 * @returns Median per-chunk cost and total stream cost.
 */
function streamingChunkCost(
  source: string,
  chunkSize: number,
  renderFn: (tokens: ReturnType<typeof parse>["tokens"]) => string,
  iterations: number,
): ChunkCost {
  const boundaries = computeBoundaries(source.length, chunkSize);
  const chunkTimes: Array<number> = [];

  for (let iter = 0; iter < iterations; iter++) {
    let state: ParserState | null = null;
    for (let c = 0; c < boundaries.length; c++) {
      const accumulated = source.slice(0, boundaries[c] ?? source.length);
      const start = performance.now();
      const result = parse(accumulated, state);
      state = result.state;
      renderFn(result.tokens);
      chunkTimes.push(performance.now() - start);
    }
  }

  chunkTimes.sort((a, b) => a - b);
  const perChunk = chunkTimes[Math.floor(chunkTimes.length / 2)] ?? 0;
  const total = chunkTimes.reduce((accumulator, current) => accumulator + current, 0) / iterations;
  return { perChunk, total };
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
 * Convert median milliseconds to megabytes per second.
 *
 * @param bytes - Input size in bytes.
 * @param ms - Median latency in milliseconds.
 * @returns Throughput in MB/s.
 */
function throughputMb(bytes: number, ms: number): number {
  return bytes / 1024 / 1024 / (ms / 1000);
}
