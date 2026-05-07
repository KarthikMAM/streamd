/**
 * Benchmark runner — measures median, p95, and throughput.
 *
 * @module bench/runner
 */

/** Result of a single benchmark run. */
export interface BenchResult {
  /** Parser/scenario name. */
  readonly name: string;
  /** Median latency in milliseconds. */
  readonly median: number;
  /** p95 latency in milliseconds. */
  readonly p95: number;
  /** Throughput in MB/s derived from median. */
  readonly throughput: number;
}

/**
 * Run a benchmark: warmup, then timed iterations.
 *
 * @param name - Human-readable identifier for the benchmark.
 * @param fn - Function under test. Return value is discarded.
 * @param src - Input string passed to `fn` on each call.
 * @param warmup - Number of discarded warmup iterations.
 * @param iterations - Number of timed iterations.
 * @returns Median, p95, and throughput statistics.
 */
export function bench(
  name: string,
  fn: (src: string) => unknown,
  src: string,
  warmup: number,
  iterations: number,
): BenchResult {
  for (let i = 0; i < warmup; i++) fn(src);

  const times: Array<number> = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn(src);
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? 0;
  const p95 = times[Math.floor(times.length * 0.95)] ?? 0;
  const throughput = src.length / 1024 / 1024 / (median / 1000);

  return { name, median, p95, throughput };
}

/** Result of a streaming benchmark run. */
export interface StreamBenchResult {
  /** Parser/scenario name. */
  readonly name: string;
  /** Chunk size in bytes. */
  readonly chunkSize: number;
  /** Median total-stream latency in milliseconds. */
  readonly totalMs: number;
  /** Median per-chunk latency in milliseconds. */
  readonly perChunkMedianMs: number;
  /** Throughput in MB/s derived from totalMs. */
  readonly throughput: number;
  /** Number of chunks in the stream. */
  readonly numChunks: number;
}

/**
 * Benchmark streaming parse — feeds source in chunks of `chunkSize` bytes.
 * Measures per-chunk parse time individually for accurate median/p95.
 *
 * @param name - Human-readable identifier for the benchmark.
 * @param parseFn - Streaming parse function. Receives accumulated source and
 *   prior state, returns an object with `state` for the next call.
 * @param src - Full source string to chunk and stream.
 * @param chunkSize - Byte length of each chunk.
 * @param warmup - Number of discarded warmup iterations.
 * @param iterations - Number of timed iterations.
 * @returns Streaming statistics including per-chunk median and throughput.
 */
export function benchStreaming(
  name: string,
  parseFn: (src: string, state?: unknown) => { state: unknown },
  src: string,
  chunkSize: number,
  warmup: number,
  iterations: number,
): StreamBenchResult {
  const chunks: Array<string> = [];
  for (let i = 0; i < src.length; i += chunkSize) {
    chunks.push(src.slice(i, Math.min(i + chunkSize, src.length)));
  }
  const numChunks = chunks.length;

  for (let w = 0; w < warmup; w++) {
    let state: unknown = null;
    let accumulated = "";
    for (let c = 0; c < numChunks; c++) {
      accumulated += chunks[c];
      state = parseFn(accumulated, state).state;
    }
  }

  const chunkTimes: Array<number> = [];
  const totalTimes: Array<number> = [];

  for (let iter = 0; iter < iterations; iter++) {
    const totalStart = performance.now();
    let state: unknown = null;
    let accumulated = "";
    for (let c = 0; c < numChunks; c++) {
      accumulated += chunks[c];
      const t0 = performance.now();
      state = parseFn(accumulated, state).state;
      chunkTimes.push(performance.now() - t0);
    }
    totalTimes.push(performance.now() - totalStart);
  }

  chunkTimes.sort((a, b) => a - b);
  totalTimes.sort((a, b) => a - b);

  const totalMs = totalTimes[Math.floor(totalTimes.length / 2)] ?? 0;
  const perChunkMedianMs = chunkTimes[Math.floor(chunkTimes.length / 2)] ?? 0;
  const throughput = src.length / 1024 / 1024 / (totalMs / 1000);

  return { name, chunkSize, totalMs, perChunkMedianMs, throughput, numChunks };
}
