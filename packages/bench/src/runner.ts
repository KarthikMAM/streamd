/**
 * Benchmark runner — measures median, p95, and throughput.
 *
 * @module bench/runner
 */

/** Result of a single benchmark run. */
export interface BenchResult {
  name: string;
  median: number;
  p95: number;
  throughput: number;
}

/** Run a benchmark: warmup, then timed iterations. */
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
  const median = times[Math.floor(times.length / 2)]!;
  const p95 = times[Math.floor(times.length * 0.95)]!;
  const throughput = src.length / 1024 / 1024 / (median / 1000);

  return { name, median, p95, throughput };
}

/** Print a markdown table of results. */
export function printTable(label: string, results: Array<BenchResult>): void {
  console.log(`\n${label}`);
  console.log("| Parser | Median (ms) | p95 (ms) | Throughput (MB/s) |");
  console.log("|---|---|---|---|");
  for (const r of results) {
    console.log(
      `| ${r.name.padEnd(20)} | ${r.median.toFixed(3).padStart(10)} | ${r.p95.toFixed(3).padStart(9)} | ${r.throughput.toFixed(1).padStart(17)} |`,
    );
  }
}

/** Result of a streaming benchmark run. */
export interface StreamBenchResult {
  name: string;
  chunkSize: number;
  totalMs: number;
  perChunkMedianMs: number;
  throughput: number;
  numChunks: number;
}

/**
 * Benchmark streaming parse — feeds source in chunks of `chunkSize` bytes.
 * Measures per-chunk parse time individually for accurate median/p95.
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

  // Warmup
  for (let w = 0; w < warmup; w++) {
    let state: unknown = null;
    let accumulated = "";
    for (let c = 0; c < numChunks; c++) {
      accumulated += chunks[c]!;
      state = parseFn(accumulated, state).state;
    }
  }

  // Measure: collect per-chunk times across all iterations
  const chunkTimes: Array<number> = [];
  const totalTimes: Array<number> = [];

  for (let iter = 0; iter < iterations; iter++) {
    const totalStart = performance.now();
    let state: unknown = null;
    let accumulated = "";
    for (let c = 0; c < numChunks; c++) {
      accumulated += chunks[c]!;
      const t0 = performance.now();
      state = parseFn(accumulated, state).state;
      chunkTimes.push(performance.now() - t0);
    }
    totalTimes.push(performance.now() - totalStart);
  }

  chunkTimes.sort((a, b) => a - b);
  totalTimes.sort((a, b) => a - b);

  const totalMs = totalTimes[Math.floor(totalTimes.length / 2)]!;
  const perChunkMedianMs = chunkTimes[Math.floor(chunkTimes.length / 2)]!;
  const throughput = src.length / 1024 / 1024 / (totalMs / 1000);

  return { name, chunkSize, totalMs, perChunkMedianMs, throughput, numChunks };
}
