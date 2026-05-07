/**
 * Structured benchmark runner used by `scripts/check-perf-regression.js`.
 *
 * Wraps the existing `bench` / `benchStreaming` helpers, captures heap
 * usage at the end of each run, and emits `BenchmarkRecord` objects
 * consumable as JSON.
 *
 * @module bench/structured-runner
 */

import { parse as streamdParse } from "@streamd/parser";
import { snapshotHeap } from "./bench-metrics";
import { generateCode, generateMixed, generateParagraphs } from "./generate";
import { bench, benchStreaming } from "./runner";
import type { BenchmarkRecord } from "./schema";
import { runHtmlStaticBenches, runHtmlStreamingBenches } from "./structured-html";
import { runPluginOverheadBenches } from "./structured-plugins";
import { runReactStaticBenches, runReactStreamingBenches } from "./structured-react";
import type { IdentifiedStaticCase, IdentifiedStreamingCase } from "./types";

/**
 * Canonical list of static-parse benchmarks captured in the baseline.
 *
 * @returns Ordered array of static cases with stable identifiers.
 */
export function staticCases(): ReadonlyArray<IdentifiedStaticCase> {
  return [
    {
      id: "static.mixed-1kb",
      label: "Mixed 1 KB",
      source: generateMixed(1),
      warmup: 500,
      iterations: 5000,
    },
    {
      id: "static.mixed-10kb",
      label: "Mixed 10 KB",
      source: generateMixed(10),
      warmup: 200,
      iterations: 2000,
    },
    {
      id: "static.mixed-50kb",
      label: "Mixed 50 KB",
      source: generateMixed(50),
      warmup: 100,
      iterations: 500,
    },
    {
      id: "static.paragraphs-50kb",
      label: "Paragraphs 50 KB",
      source: generateParagraphs(50),
      warmup: 100,
      iterations: 500,
    },
    {
      id: "static.code-50kb",
      label: "Code blocks 50 KB",
      source: generateCode(50),
      warmup: 100,
      iterations: 500,
    },
    {
      id: "static.pathological-star",
      label: "Pathological * x10000",
      source: "*".repeat(10000),
      warmup: 200,
      iterations: 2000,
    },
    {
      id: "static.pathological-blockquote",
      label: "Pathological > x200",
      source: `${"> ".repeat(200)}text`,
      warmup: 200,
      iterations: 2000,
    },
  ];
}

/**
 * Canonical list of streaming benchmarks captured in the baseline.
 *
 * @returns Ordered array of streaming cases with stable identifiers.
 */
export function streamingCases(): ReadonlyArray<IdentifiedStreamingCase> {
  return [
    {
      id: "streaming.mixed-50kb.chunk-50",
      label: "Mixed 50 KB / 50B chunks",
      source: generateMixed(50),
      chunkSize: 50,
      warmup: 20,
      iterations: 50,
    },
    {
      id: "streaming.mixed-50kb.chunk-200",
      label: "Mixed 50 KB / 200B chunks",
      source: generateMixed(50),
      chunkSize: 200,
      warmup: 20,
      iterations: 50,
    },
    {
      id: "streaming.mixed-50kb.chunk-1000",
      label: "Mixed 50 KB / 1KB chunks",
      source: generateMixed(50),
      chunkSize: 1000,
      warmup: 20,
      iterations: 50,
    },
  ];
}

/**
 * Run every static case and capture heap usage.
 *
 * @returns Array of benchmark records for all static cases.
 */
export function runStaticBenches(): Array<BenchmarkRecord> {
  const records: Array<BenchmarkRecord> = [];

  for (const testCase of staticCases()) {
    const before = snapshotHeap();
    const result = bench(
      testCase.label,
      (input) => streamdParse(input),
      testCase.source,
      testCase.warmup,
      testCase.iterations,
    );
    const after = snapshotHeap();
    records.push({
      id: testCase.id,
      label: testCase.label,
      kind: "static",
      inputBytes: testCase.source.length,
      medianMs: result.median,
      p95Ms: result.p95,
      throughputMbPerS: result.throughput,
      heapUsedBytes: Math.max(0, after - before),
    });
  }

  return records;
}

/**
 * Run every streaming case and capture heap usage.
 *
 * @returns Array of benchmark records for all streaming cases.
 */
export function runStreamingBenches(): Array<BenchmarkRecord> {
  const records: Array<BenchmarkRecord> = [];

  for (const testCase of streamingCases()) {
    const before = snapshotHeap();
    const result = benchStreaming(
      testCase.label,
      (accumulated, state) => streamdParse(accumulated, state as null),
      testCase.source,
      testCase.chunkSize,
      testCase.warmup,
      testCase.iterations,
    );
    const after = snapshotHeap();
    records.push({
      id: testCase.id,
      label: testCase.label,
      kind: "streaming",
      inputBytes: testCase.source.length,
      medianMs: result.totalMs,
      p95Ms: result.totalMs,
      throughputMbPerS: result.throughput,
      perChunkMedianMs: result.perChunkMedianMs,
      numChunks: result.numChunks,
      heapUsedBytes: Math.max(0, after - before),
    });
  }

  return records;
}

/**
 * Run every benchmark section in order.
 *
 * Sections contribute records with distinct `id` prefixes — `static.*`,
 * `streaming.*`, `html.*`, `react.*`, `plugins.*` — so the regression
 * gate can diff them independently.
 *
 * @returns Combined array of all benchmark records.
 */
export function runAllBenches(): Array<BenchmarkRecord> {
  return [
    ...runStaticBenches(),
    ...runStreamingBenches(),
    ...runHtmlStaticBenches(),
    ...runHtmlStreamingBenches(),
    ...runReactStaticBenches(),
    ...runReactStreamingBenches(),
    ...runPluginOverheadBenches(),
  ];
}
