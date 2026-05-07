/**
 * Machine-readable benchmark result format.
 *
 * Consumers:
 *  - `scripts/check-perf-regression.js` compares a fresh run against
 *    `bench/baseline.json`.
 *  - `scripts/update-perf-baseline.js` rewrites `bench/baseline.json` from
 *    a fresh run when numbers intentionally improve.
 *
 * The schema is versioned so consumers can reject unknown formats.
 *
 * @module bench/schema
 */

/** Current JSON schema version. Bump on breaking shape changes. */
export const BASELINE_SCHEMA_VERSION = 1 as const;

/**
 * Type of benchmark — determines which metrics are meaningful.
 *
 * - `static` / `streaming`: parser-only cases (O(K) streaming contract).
 * - `html-static` / `html-streaming`: `@streamd/html` renderer throughput.
 * - `react-static` / `react-streaming`: `@streamd/react` server render.
 * - `plugin-overhead`: incremental cost of the built-in plugin bundle
 *   (headingAnchors + linkAttributes + sanitize).
 *
 * New kinds are additive. Consumers that discriminate on `kind` must
 * treat unknown values as an opt-out (new record → passthrough) rather
 * than a hard failure.
 */
export type BenchmarkKind =
  | "static"
  | "streaming"
  | "html-static"
  | "html-streaming"
  | "react-static"
  | "react-streaming"
  | "plugin-overhead";

/** A single datapoint captured by the runner. */
export interface BenchmarkRecord {
  /** Stable identifier, e.g. "static.mixed-50kb" — used as the diff key. */
  readonly id: string;
  /** Human-readable label for console output. */
  readonly label: string;
  /** Benchmark category — determines which metrics are meaningful for this record. */
  readonly kind: BenchmarkKind;
  /** Source size in bytes. */
  readonly inputBytes: number;
  /** Median single-call / streaming-total latency in ms. */
  readonly medianMs: number;
  /** p95 of the same samples. */
  readonly p95Ms: number;
  /**
   * p99 of the same samples. Optional — only captured for streaming kinds
   * where tail latency is the primary stability signal. Absent on
   * pre-existing parser records to preserve backward compatibility with
   * baselines committed before this field existed.
   */
  readonly p99Ms?: number;
  /** Throughput in MB/s derived from medianMs. */
  readonly throughputMbPerS: number;
  /** Streaming only: per-chunk median latency. */
  readonly perChunkMedianMs?: number;
  /** Streaming only: per-chunk p99 latency. */
  readonly perChunkP99Ms?: number;
  /** Streaming only: number of chunks per session. */
  readonly numChunks?: number;
  /** Heap bytes at end of the measured run. */
  readonly heapUsedBytes: number;
}

/**
 * Per-record regression tolerance override map.
 *
 * Keys are record `id`s. Values are percent deltas interpreted the same
 * way as the CLI `--threshold` default: a throughput drop of more than
 * this percentage from baseline counts as a regression.
 *
 * When a record's id is absent from the map, the CLI default applies.
 * Use this to widen tolerance on records that are inherently noisier
 * (React SSR, streaming per-chunk latency) without loosening the bar for
 * the parser hot path.
 */
export type PerRecordTolerance = Readonly<Record<string, number>>;

/** Full baseline document committed at `packages/bench/baseline.json`. */
export interface BaselineDocument {
  readonly schemaVersion: typeof BASELINE_SCHEMA_VERSION;
  readonly capturedAt: string;
  readonly node: string;
  readonly platform: string;
  /**
   * Optional per-record tolerance overrides. Absent on the first baseline
   * emitted by `capture.ts`; populated either by hand or by
   * `update-perf-baseline.js` when the author widens a specific record.
   */
  readonly perRecordTolerance?: PerRecordTolerance;
  readonly records: ReadonlyArray<BenchmarkRecord>;
}

/**
 * Build a fresh BaselineDocument from a record list.
 *
 * @param records Records captured by `runAllBenches`. Must be ordered
 *   deterministically by the runner so the committed baseline diff stays
 *   stable across captures.
 * @returns A baseline document with `schemaVersion`, capture timestamp,
 *   node version, and platform stamped in. `perRecordTolerance` is
 *   omitted — callers that want per-record overrides must set the field
 *   explicitly (usually by editing the committed baseline by hand).
 */
export function buildBaseline(records: ReadonlyArray<BenchmarkRecord>): BaselineDocument {
  return {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    records,
  };
}
