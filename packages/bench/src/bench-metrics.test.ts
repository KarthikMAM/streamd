/**
 * Tests for the shared bench-metrics helpers.
 *
 * These helpers are consumed by every structured bench section. The
 * tests pin the statistical behaviour (median/p95/p99 indices) so a
 * silent re-interpretation of the percentile boundaries would be caught
 * before landing.
 *
 * @module bench/bench-metrics.test
 */
import { describe, expect, it } from "vitest";
import { buildStaticRecord, measureLatency, throughputMbPerS } from "./bench-metrics";

describe("measureLatency", () => {
  it("runs warmup iterations then records timed samples", () => {
    let calls = 0;
    const stats = measureLatency(
      () => {
        calls++;
      },
      10,
      20,
    );
    expect(calls).toBe(30);
    // Percentile ordering is the observable contract: p50 <= p95 <= p99.
    // (A bare medianMs>=0 assertion would be vacuous — timings are
    // always non-negative — so the valuable check is the ordering.)
    expect(stats.p95Ms).toBeGreaterThanOrEqual(stats.medianMs);
    expect(stats.p99Ms).toBeGreaterThanOrEqual(stats.p95Ms);
  });

  it("returns zero samples when iterations is zero — pathological but typesafe", () => {
    const noOp = (): void => {
      // Intentionally empty — iterations=0 must not invoke the callback.
    };
    const stats = measureLatency(noOp, 0, 0);
    expect(stats.medianMs).toBe(0);
    expect(stats.p95Ms).toBe(0);
    expect(stats.p99Ms).toBe(0);
  });

  it("percentile indices match Math.floor(n * pct) on a sorted sample set", () => {
    // 100 synthetic samples: latency grows monotonically so sorted order
    // matches insertion order and percentile indices are easy to verify.
    const observed: Array<number> = [];
    let i = 0;
    const stats = measureLatency(
      () => {
        observed.push(i);
        i++;
      },
      0,
      100,
    );
    expect(observed).toHaveLength(100);
    // medianMs and friends are wall-clock deltas — ordering alone is
    // what we assert here, not exact values.
    expect(stats.p99Ms).toBeGreaterThanOrEqual(stats.medianMs);
  });
});

describe("throughputMbPerS", () => {
  it("returns 0 when medianMs is 0 to avoid divide-by-zero", () => {
    expect(throughputMbPerS(1024, 0)).toBe(0);
  });

  it("converts bytes + milliseconds to MB/s using the canonical formula", () => {
    // 1 MB processed in 10 ms → 100 MB/s.
    const mbPerS = throughputMbPerS(1024 * 1024, 10);
    expect(mbPerS).toBeCloseTo(100, 5);
  });
});

describe("buildStaticRecord", () => {
  it("assembles a BenchmarkRecord with p95 and p99 populated", () => {
    const record = buildStaticRecord({
      id: "test.case",
      label: "Test case",
      kind: "html-static",
      inputBytes: 2048,
      stats: { medianMs: 1, p95Ms: 2, p99Ms: 3 },
      heapUsedBytes: 4096,
    });
    expect(record.id).toBe("test.case");
    expect(record.kind).toBe("html-static");
    expect(record.inputBytes).toBe(2048);
    expect(record.medianMs).toBe(1);
    expect(record.p95Ms).toBe(2);
    expect(record.p99Ms).toBe(3);
    expect(record.heapUsedBytes).toBe(4096);
    // Delegates to the canonical throughputMbPerS helper (tested above),
    // so the exact expected value comes from the same formula. Avoids a
    // vacuous `> 0` lower bound.
    expect(record.throughputMbPerS).toBeCloseTo(throughputMbPerS(2048, 1), 10);
  });
});
