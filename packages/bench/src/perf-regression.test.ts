/**
 * Tests for the exported helpers in `scripts/check-perf-regression.js`.
 *
 * The script itself runs a full build + capture pipeline when invoked
 * as a CLI entry point. These tests exercise only the pure helpers it
 * exports via `module.exports`, never triggering the main orchestration.
 *
 * @module bench/perf-regression.test
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
// Resolve relative to the repo root (the workspace the bench package sits in).
const scriptPath = resolve(here, "../../../scripts/check-perf-regression.js");
const perf = require_(scriptPath) as {
  classifyDelta: (delta: number, tolerance: number) => "REGRESSED" | "improved" | "steady";
  combine: (docs: ReadonlyArray<PerfDoc>) => Array<CombinedSample>;
  compare: (
    baseline: PerfDoc,
    fresh: ReadonlyArray<CombinedSample>,
    defaultThreshold: number,
  ) => {
    report: Array<ReportEntry>;
    regressions: Array<ReportEntry>;
  };
  median: (nums: ReadonlyArray<number>) => number;
  parseArgs: (argv: ReadonlyArray<string>) => {
    threshold: number;
    runs: number;
    retryOnFalsePositive: boolean;
  };
  percentDelta: (current: number, baseline: number) => number;
  resolveTolerance: (
    id: string,
    perRecordTolerance: Record<string, number> | null,
    defaultThreshold: number,
  ) => number;
};

interface CombinedSample {
  readonly id: string;
  readonly label: string;
  readonly throughputMbPerS: number;
  readonly medianMs: number;
}

interface PerfDoc {
  readonly records: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly throughputMbPerS: number;
    readonly medianMs: number;
    readonly heapUsedBytes: number;
    readonly perChunkMedianMs?: number;
  }>;
  readonly perRecordTolerance?: Record<string, number>;
}

interface ReportEntry {
  readonly id: string;
  readonly label: string;
  readonly baseThroughput: number;
  readonly curThroughput: number;
  readonly delta: number;
  readonly status: "new" | "steady" | "improved" | "REGRESSED";
  readonly tolerance: number;
}

describe("parseArgs", () => {
  it("applies defaults when no flags are passed", () => {
    const { threshold, runs, retryOnFalsePositive } = perf.parseArgs([]);
    expect(threshold).toBe(15);
    expect(runs).toBe(3);
    expect(retryOnFalsePositive).toBe(false);
  });

  it("parses --threshold, --runs, and --retry-on-false-positive", () => {
    const args = perf.parseArgs(["--threshold=10", "--runs=5", "--retry-on-false-positive"]);
    expect(args.threshold).toBe(10);
    expect(args.runs).toBe(5);
    expect(args.retryOnFalsePositive).toBe(true);
  });
});

describe("median", () => {
  it("returns the middle sample for odd-length input", () => {
    expect(perf.median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle samples for even-length input", () => {
    expect(perf.median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("percentDelta + classifyDelta", () => {
  it("returns 0 when baseline is 0 to avoid divide-by-zero", () => {
    expect(perf.percentDelta(100, 0)).toBe(0);
  });

  it("classifies deltas against the tolerance", () => {
    expect(perf.classifyDelta(-20, 15)).toBe("REGRESSED");
    expect(perf.classifyDelta(-10, 15)).toBe("steady");
    expect(perf.classifyDelta(20, 15)).toBe("improved");
    expect(perf.classifyDelta(0, 15)).toBe("steady");
  });
});

describe("resolveTolerance", () => {
  it("falls back to the default threshold when perRecordTolerance is null", () => {
    expect(perf.resolveTolerance("any.id", null, 15)).toBe(15);
  });

  it("prefers the per-record override when present", () => {
    expect(perf.resolveTolerance("noisy.id", { "noisy.id": 30 }, 15)).toBe(30);
  });

  it("ignores non-number overrides and falls back to the default", () => {
    const bogus = { "bad.id": "not-a-number" as unknown as number };
    expect(perf.resolveTolerance("bad.id", bogus, 15)).toBe(15);
  });

  it("ignores missing overrides and falls back to the default", () => {
    expect(perf.resolveTolerance("unknown.id", { other: 20 }, 15)).toBe(15);
  });
});

describe("combine", () => {
  it("computes the median throughput across multiple docs per record id", () => {
    const docs: Array<PerfDoc> = [
      {
        records: [{ id: "a", label: "a", throughputMbPerS: 100, medianMs: 1, heapUsedBytes: 0 }],
      },
      {
        records: [{ id: "a", label: "a", throughputMbPerS: 200, medianMs: 0.5, heapUsedBytes: 0 }],
      },
      {
        records: [{ id: "a", label: "a", throughputMbPerS: 150, medianMs: 0.6, heapUsedBytes: 0 }],
      },
    ];
    const combined = perf.combine(docs);
    expect(combined).toHaveLength(1);
    expect(combined[0]?.id).toBe("a");
    expect(combined[0]?.throughputMbPerS).toBe(150);
  });
});

describe("compare", () => {
  const baseline: PerfDoc = {
    records: [
      { id: "fast", label: "fast", throughputMbPerS: 100, medianMs: 1, heapUsedBytes: 0 },
      { id: "noisy", label: "noisy", throughputMbPerS: 50, medianMs: 2, heapUsedBytes: 0 },
    ],
    perRecordTolerance: { noisy: 40 },
  };

  it("flags a record as REGRESSED when throughput drops past the default threshold", () => {
    const fresh: Array<CombinedSample> = [
      { id: "fast", label: "fast", throughputMbPerS: 80, medianMs: 1.25 },
    ];
    const { regressions } = perf.compare(baseline, fresh, 15);
    expect(regressions).toHaveLength(1);
    expect(regressions[0]?.id).toBe("fast");
    expect(regressions[0]?.tolerance).toBe(15);
  });

  it("honours per-record tolerance overrides — widens noisy records without loosening the default", () => {
    const fresh: Array<CombinedSample> = [
      { id: "noisy", label: "noisy", throughputMbPerS: 38, medianMs: 2.6 },
    ];
    const { report, regressions } = perf.compare(baseline, fresh, 15);
    // 24% drop is past default 15% but inside the override of 40%.
    expect(regressions).toHaveLength(0);
    expect(report[0]?.status).toBe("steady");
    expect(report[0]?.tolerance).toBe(40);
  });

  it("marks new records without a baseline counterpart as `new`", () => {
    const fresh: Array<CombinedSample> = [
      { id: "brand-new", label: "brand-new", throughputMbPerS: 123, medianMs: 0.5 },
    ];
    const { report, regressions } = perf.compare(baseline, fresh, 15);
    expect(report[0]?.status).toBe("new");
    expect(regressions).toHaveLength(0);
  });
});
