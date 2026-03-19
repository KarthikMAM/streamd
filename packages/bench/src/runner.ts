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
