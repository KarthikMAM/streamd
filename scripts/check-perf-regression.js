#!/usr/bin/env node
/**
 * Compare a fresh benchmark run against the committed baseline and
 * fail if any record regressed more than the configured threshold.
 *
 * A "regression" means: throughput dropped relative to the baseline.
 * Because benchmarks are noisy on shared CI runners, we:
 *   1. Run the capture N times (default 3) and take the median.
 *   2. Compute percent delta per record.
 *   3. Fail only on records that regressed by more than their
 *      configured tolerance.
 *
 * Tolerance resolution order:
 *   1. `baseline.perRecordTolerance[id]` if present in the committed
 *      baseline document (per-record override, lets noisier records
 *      like React SSR widen their gate without loosening the parser).
 *   2. The CLI `--threshold` value (default 15%).
 *
 * Usage:
 *   node scripts/check-perf-regression.js                              # defaults
 *   node scripts/check-perf-regression.js --runs=5 --threshold=10
 *   node scripts/check-perf-regression.js --retry-on-false-positive    # re-run once on regression
 *
 * When used as a non-blocking gate in CI, set PERF_REGRESSION_WARN_ONLY=1
 * to log a warning and exit 0 instead of failing.
 */

const { execFileSync, spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

/** Default threshold — a record regressing by more than this percent fails CI. */
const DEFAULT_THRESHOLD_PCT = 15;
/** Default sample count — median-of-3 is enough to kill ~5% noise. */
const DEFAULT_RUNS = 3;
const BASELINE_PATH = join("packages", "bench", "baseline.json");

function parseArgs(argv) {
  let threshold = DEFAULT_THRESHOLD_PCT;
  let runs = DEFAULT_RUNS;
  let retryOnFalsePositive = false;
  for (const a of argv) {
    if (a.startsWith("--threshold=")) threshold = Number.parseFloat(a.slice("--threshold=".length));
    else if (a.startsWith("--runs=")) runs = Number.parseInt(a.slice("--runs=".length), 10);
    else if (a === "--retry-on-false-positive") retryOnFalsePositive = true;
  }
  return { threshold, runs, retryOnFalsePositive };
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  } catch (err) {
    console.error(`Could not read ${BASELINE_PATH}: ${err.message}`);
    console.error("Run: node scripts/update-perf-baseline.js");
    process.exit(1);
  }
}

function runCapture() {
  const r = spawnSync("npx", ["tsx", "src/capture.ts"], {
    cwd: "packages/bench",
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error(`capture failed with status ${r.status}`);
  }
  return JSON.parse(r.stdout);
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function appendRecords(byId, records) {
  for (const r of records) {
    if (!byId.has(r.id)) byId.set(r.id, []);
    byId.get(r.id).push(r);
  }
}

function groupById(docs) {
  const byId = new Map();
  for (const doc of docs) appendRecords(byId, doc.records);
  return byId;
}

function combine(docs) {
  const byId = groupById(docs);
  const out = [];
  for (const [id, samples] of byId) {
    out.push({
      id,
      label: samples[0].label,
      throughputMbPerS: median(samples.map((s) => s.throughputMbPerS)),
      medianMs: median(samples.map((s) => s.medianMs)),
    });
  }
  return out;
}

function percentDelta(current, baseline) {
  if (baseline === 0) return 0;
  return ((current - baseline) / baseline) * 100;
}

/**
 * Resolve the tolerance to apply for a single record. Per-record
 * overrides win over the CLI default. Non-number values in the override
 * map are ignored so a malformed baseline can't silently disable the
 * gate — the default threshold still applies.
 */
function resolveTolerance(id, perRecordTolerance, defaultThreshold) {
  if (!perRecordTolerance || typeof perRecordTolerance !== "object") return defaultThreshold;
  const override = perRecordTolerance[id];
  if (typeof override !== "number" || !Number.isFinite(override)) return defaultThreshold;
  return override;
}

function classifyDelta(delta, tolerance) {
  if (delta < -tolerance) return "REGRESSED";
  if (delta > tolerance) return "improved";
  return "steady";
}

function buildNewEntry(cur, tolerance) {
  return {
    id: cur.id,
    label: cur.label,
    status: "new",
    baseThroughput: 0,
    curThroughput: cur.throughputMbPerS,
    delta: 0,
    tolerance,
  };
}

function buildComparedEntry(cur, base, tolerance) {
  const delta = percentDelta(cur.throughputMbPerS, base.throughputMbPerS);
  return {
    id: cur.id,
    label: cur.label,
    baseThroughput: base.throughputMbPerS,
    curThroughput: cur.throughputMbPerS,
    delta,
    status: classifyDelta(delta, tolerance),
    tolerance,
  };
}

function compare(baseline, fresh, defaultThreshold) {
  const baselineById = new Map(baseline.records.map((r) => [r.id, r]));
  const perRecordTolerance = baseline.perRecordTolerance ?? null;
  const report = [];
  const regressions = [];
  for (const cur of fresh) {
    const tolerance = resolveTolerance(cur.id, perRecordTolerance, defaultThreshold);
    const base = baselineById.get(cur.id);
    const entry = base ? buildComparedEntry(cur, base, tolerance) : buildNewEntry(cur, tolerance);
    report.push(entry);
    if (entry.status === "REGRESSED") regressions.push(entry);
  }
  return { report, regressions };
}

function printReport(report, defaultThreshold) {
  const colWidths = [44, 12, 12, 10, 10, 12];
  const header = ["id", "base MB/s", "cur MB/s", "Δ %", "tol %", "status"];
  const divider = `|${colWidths.map((w) => "-".repeat(w + 2)).join("|")}|`;
  const row = (cells) => `| ${cells.map((c, i) => c.padEnd(colWidths[i] ?? 0)).join(" | ")} |`;
  console.log(row(header));
  console.log(divider);
  for (const r of report) {
    console.log(
      row([
        r.id,
        r.baseThroughput.toFixed(2),
        r.curThroughput.toFixed(2),
        `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)}`,
        `±${r.tolerance}`,
        r.status,
      ]),
    );
  }
  console.log(
    `\nDefault threshold: ±${defaultThreshold}%. Per-record overrides from baseline.perRecordTolerance take precedence.`,
  );
}

function captureFreshSamples(runs) {
  console.log(`\nCapturing ${runs} fresh run(s)…`);
  const docs = [];
  for (let i = 0; i < runs; i++) {
    console.log(`  run ${i + 1}/${runs}`);
    docs.push(runCapture());
  }
  return docs;
}

function printRegressionFooter(regressions) {
  console.error(
    `\n[FAIL] ${regressions.length} benchmark(s) regressed beyond their configured tolerance:`,
  );
  for (const r of regressions) {
    console.error(
      `  ${r.id}: ${r.baseThroughput.toFixed(2)} → ${r.curThroughput.toFixed(2)} MB/s (${r.delta.toFixed(1)}%, tol ±${r.tolerance}%)`,
    );
  }
  console.error("\nEither:");
  console.error("  - Fix the regression (preferred), or");
  console.error("  - Regenerate the baseline: node scripts/update-perf-baseline.js");
}

function main() {
  const { threshold, runs, retryOnFalsePositive } = parseArgs(process.argv.slice(2));

  console.log("Building parser + renderers + plugins…");
  execFileSync(
    "npx",
    [
      "turbo",
      "run",
      "build",
      "--filter=@streamd/parser",
      "--filter=@streamd/html",
      "--filter=@streamd/react",
      "--filter=@streamd/plugins",
      "--filter=@streamd/tokens",
    ],
    { stdio: "inherit" },
  );

  let docs = captureFreshSamples(runs);
  const baseline = loadBaseline();
  let fresh = combine(docs);
  let { report, regressions } = compare(baseline, fresh, threshold);

  console.log(`\nBaseline vs fresh (median-of-${runs} on ${process.platform}-${process.arch}):\n`);
  printReport(report, threshold);

  if (regressions.length > 0 && retryOnFalsePositive) {
    console.log(
      `\nDetected ${regressions.length} regression(s); --retry-on-false-positive is set — capturing ${runs} more run(s) and re-medianising…`,
    );
    docs = [...docs, ...captureFreshSamples(runs)];
    fresh = combine(docs);
    ({ report, regressions } = compare(baseline, fresh, threshold));
    console.log(`\nRetry result (median-of-${docs.length}):\n`);
    printReport(report, threshold);
  }

  if (regressions.length === 0) {
    console.log("\ncheck-perf-regression: clean");
    process.exit(0);
  }

  printRegressionFooter(regressions);

  if (process.env.PERF_REGRESSION_WARN_ONLY === "1") {
    console.error("\n(PERF_REGRESSION_WARN_ONLY=1 set — failing as a warning only.)");
    process.exit(0);
  }
  process.exit(1);
}

// Expose pure helpers for unit testing. Only the orchestration (main)
// invokes child processes and touches the filesystem; helpers are safe
// to import from test code.
module.exports = {
  classifyDelta,
  combine,
  compare,
  median,
  parseArgs,
  percentDelta,
  resolveTolerance,
};

if (require.main === module) main();
