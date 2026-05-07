/**
 * Shared types for the bench harness. Extracting these here keeps the
 * per-script signatures short and makes the contract between the runner
 * modules and their helpers explicit.
 *
 * @module bench/types
 */

/**
 * Result of parsing the bench harness argv.
 *
 * Only the `--out=<path>` flag is currently recognised — when absent the
 * caller writes JSON to stdout instead of a file.
 */
export interface ParseArgsResult {
  /** Optional destination path captured from `--out=<path>`. */
  readonly outPath?: string;
}

/**
 * A single parser under test in the static-parse comparison.
 *
 * `fn` receives the full source string and returns whatever the parser
 * produces (tree, tokens, HTML). The return value is discarded by the
 * bench harness — only the call timing is measured.
 */
export interface ParserBenchTarget {
  /** Human-readable parser name shown in bench tables. */
  readonly name: string;
  /** Parse function invoked once per iteration. */
  readonly fn: (src: string) => unknown;
}

/**
 * Single static benchmark input — full source parsed at once
 * (warmup + iterations).
 */
export interface StaticInput {
  /** Human-readable label for the benchmark row. */
  readonly label: string;
  /** Full markdown source to parse. */
  readonly source: string;
  /** Number of warmup iterations (discarded). */
  readonly warmup: number;
  /** Number of timed iterations. */
  readonly iterations: number;
}

/** Result of a streaming benchmark. */
export interface StreamResult {
  /** Parser name. */
  readonly name: string;
  /** Number of chunk boundaries in the stream. */
  readonly numChunks: number;
  /** Median total-stream latency in milliseconds. */
  readonly totalMedianMs: number;
  /** Median per-chunk latency in milliseconds. */
  readonly perChunkMedianMs: number;
  /** Throughput in MB/s derived from totalMedianMs. */
  readonly throughput: number;
}

/** Output of a streaming measurement: per-chunk times and cumulative totals, all in milliseconds. */
export interface MeasurementResult {
  /** Per-chunk latency samples in milliseconds. */
  readonly chunkTimes: Array<number>;
  /** Per-iteration total latency samples in milliseconds. */
  readonly totalTimes: Array<number>;
}

/**
 * Single static (non-streaming) benchmark case with a stable identifier.
 * Used by the structured runner and baseline capture.
 */
export interface IdentifiedStaticCase {
  /** Stable identifier used as the diff key in baseline comparisons. */
  readonly id: string;
  /** Human-readable label for console output. */
  readonly label: string;
  /** Full markdown source to parse. */
  readonly source: string;
  /** Number of warmup iterations (discarded). */
  readonly warmup: number;
  /** Number of timed iterations. */
  readonly iterations: number;
}

/**
 * Single streaming benchmark case with a stable identifier.
 * Used by the structured runner and baseline capture.
 */
export interface IdentifiedStreamingCase {
  /** Stable identifier used as the diff key in baseline comparisons. */
  readonly id: string;
  /** Human-readable label for console output. */
  readonly label: string;
  /** Full markdown source to stream. */
  readonly source: string;
  /** Byte step used to feed the source incrementally. */
  readonly chunkSize: number;
  /** Number of warmup iterations (discarded). */
  readonly warmup: number;
  /** Number of timed iterations. */
  readonly iterations: number;
}

/** Labeled markdown input sized for the bench suite (1 KB / 10 KB / 50 KB tiers). */
export interface SizedInput {
  /** Human-readable size label. */
  readonly label: string;
  /** Generated markdown source at the target size. */
  readonly source: string;
}

/** Measured median chunk cost + per-stream total for a renderer. */
export interface ChunkCost {
  /** Median per-chunk latency in milliseconds. */
  readonly perChunk: number;
  /** Total stream latency in milliseconds. */
  readonly total: number;
}

/** Summary row for a single streaming-profile scenario. All timings are in nanoseconds. */
export interface ProfileResult {
  /** Human-readable scenario label. */
  readonly label: string;
  /** Total number of chunks in the stream. */
  readonly totalChunks: number;
  /** Median per-chunk latency in nanoseconds. */
  readonly medianNs: number;
  /** p99 per-chunk latency in nanoseconds. */
  readonly p99Ns: number;
  /** Minimum per-chunk latency in nanoseconds. */
  readonly minNs: number;
  /** Maximum per-chunk latency in nanoseconds. */
  readonly maxNs: number;
}

/**
 * Static-render case for the HTML/React structured benchmarks.
 * Labelled + sized markdown input with capture parameters.
 */
export interface RendererStaticCase {
  /** Stable identifier for baseline comparison. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** Source size in kilobytes. */
  readonly sizeKb: number;
  /** Number of warmup iterations (discarded). */
  readonly warmup: number;
  /** Number of timed iterations. */
  readonly iterations: number;
}

/**
 * Streaming-render case for the HTML/React structured benchmarks.
 * Defines chunk size and iteration counts for per-chunk timing capture.
 */
export interface RendererStreamingCase {
  /** Stable identifier for baseline comparison. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** Source size in kilobytes. */
  readonly sizeKb: number;
  /** Byte step used to feed the source incrementally. */
  readonly chunkSize: number;
  /** Number of warmup iterations (discarded). */
  readonly warmup: number;
  /** Number of timed iterations. */
  readonly iterations: number;
}
