/**
 * Shared latency-sampling helper used by the structured bench sections.
 *
 * Wraps the existing `performance.now()` warmup + iterations loop, but
 * returns median, p95, and p99 as distinct fields so callers can report
 * tail latency. The original `bench` helper in `runner.ts` only exposes
 * median + p95; the structured baseline records also want p99 for the
 * streaming and renderer cases where tail latency is the stability
 * signal that matters.
 *
 * @module bench/bench-metrics
 */
import type { BenchmarkRecord } from "./schema";

/** Distribution summary for a set of per-iteration latency samples, all in ms. */
export interface LatencyStats {
  /** Median (p50) sample in milliseconds. */
  readonly medianMs: number;
  /** p95 sample in milliseconds. */
  readonly p95Ms: number;
  /** p99 sample in milliseconds. */
  readonly p99Ms: number;
}

/**
 * Run `fn` through `warmup` discarded invocations and `iterations` timed
 * invocations, returning median / p95 / p99 of the timed samples.
 *
 * @param fn Function under test. Return value is discarded — only the
 *   wall-clock delta around the call is recorded.
 * @param warmup Pre-warm iterations to let V8 JIT the call site. Must be
 *   non-negative.
 * @param iterations Timed iterations. Must be at least 1 — the `?? 0`
 *   fallbacks below satisfy the type system for the pathological
 *   zero-iteration case but never fire in practice.
 */
export function measureLatency(
  fn: () => unknown,
  warmup: number,
  iterations: number,
): LatencyStats {
  for (let i = 0; i < warmup; i++) fn();

  const samples: Array<number> = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }

  samples.sort((a, b) => a - b);
  return {
    medianMs: samples[Math.floor(samples.length / 2)] ?? 0,
    p95Ms: samples[Math.floor(samples.length * 0.95)] ?? 0,
    p99Ms: samples[Math.floor(samples.length * 0.99)] ?? 0,
  };
}

/**
 * Derive throughput in MB/s from a single-call median and byte count.
 *
 * @param bytes Size of the input processed per call.
 * @param medianMs Median single-call latency in milliseconds. Must be
 *   positive — zero would divide-by-zero, which only happens when every
 *   sample rounded to sub-nanosecond precision.
 * @returns `bytes / 1024 / 1024 / (medianMs / 1000)` — the standard
 *   MB/s conversion used across the bench harness.
 */
export function throughputMbPerS(bytes: number, medianMs: number): number {
  if (medianMs === 0) return 0;
  return bytes / 1024 / 1024 / (medianMs / 1000);
}

/** Take a heap snapshot. Forces GC when the host was started with `--expose-gc`. */
export function snapshotHeap(): number {
  if (typeof global.gc === "function") global.gc();
  return process.memoryUsage().heapUsed;
}

/** Shape of the input passed to `buildStaticRecord` — every metric provided pre-computed. */
export interface StaticRecordInput {
  readonly id: string;
  readonly label: string;
  readonly kind: BenchmarkRecord["kind"];
  readonly inputBytes: number;
  readonly stats: LatencyStats;
  readonly heapUsedBytes: number;
}

/** Assemble a `BenchmarkRecord` for a static (non-streaming) case. */
export function buildStaticRecord(input: StaticRecordInput): BenchmarkRecord {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    inputBytes: input.inputBytes,
    medianMs: input.stats.medianMs,
    p95Ms: input.stats.p95Ms,
    p99Ms: input.stats.p99Ms,
    throughputMbPerS: throughputMbPerS(input.inputBytes, input.stats.medianMs),
    heapUsedBytes: input.heapUsedBytes,
  };
}
