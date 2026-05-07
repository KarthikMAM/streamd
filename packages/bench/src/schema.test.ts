/**
 * Tests for the baseline schema module.
 *
 * These assertions are small but load-bearing: the committed
 * `baseline.json` is compared byte-for-byte against schema-emitted
 * output, so any drift in `BASELINE_SCHEMA_VERSION` or the shape of
 * `buildBaseline()` output would invalidate every downstream baseline.
 *
 * @module bench/schema.test
 */
import { describe, expect, it } from "vitest";
import type { BenchmarkRecord } from "./schema";
import { BASELINE_SCHEMA_VERSION, buildBaseline } from "./schema";

describe("BASELINE_SCHEMA_VERSION", () => {
  it("is pinned to 1 — do not bump without migrating committed baselines", () => {
    expect(BASELINE_SCHEMA_VERSION).toBe(1);
  });
});

describe("buildBaseline", () => {
  it("stamps schema version, node, platform, and capturedAt", () => {
    const doc = buildBaseline([]);
    expect(doc.schemaVersion).toBe(BASELINE_SCHEMA_VERSION);
    expect(doc.node).toBe(process.version);
    expect(doc.platform).toBe(`${process.platform}-${process.arch}`);
    expect(doc.records).toEqual([]);
    expect(typeof doc.capturedAt).toBe("string");
    expect(Number.isNaN(Date.parse(doc.capturedAt))).toBe(false);
  });

  it("does NOT inject a perRecordTolerance field — callers must opt in", () => {
    const doc = buildBaseline([]);
    expect("perRecordTolerance" in doc).toBe(false);
  });

  it("preserves input records without mutation", () => {
    const record: BenchmarkRecord = {
      id: "x",
      label: "x",
      kind: "html-static",
      inputBytes: 1024,
      medianMs: 0.5,
      p95Ms: 1,
      p99Ms: 2,
      throughputMbPerS: 1000,
      heapUsedBytes: 0,
    };
    const doc = buildBaseline([record]);
    expect(doc.records).toHaveLength(1);
    expect(doc.records[0]).toBe(record);
  });
});
