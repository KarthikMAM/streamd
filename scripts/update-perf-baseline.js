#!/usr/bin/env node
/**
 * Run the benchmark capture N times and write the median of each metric
 * to `packages/bench/baseline.json`.
 *
 * Why median-of-many: a single run on a shared CI host is noisy (5–15% swings).
 * Medianising three runs knocks that down to ~3% while keeping wall time under
 * 90 seconds.
 *
 * Usage:
 *   node scripts/update-perf-baseline.js            # 3 runs, default
 *   node scripts/update-perf-baseline.js --runs=5   # more samples
 */

const { execFileSync, spawnSync } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

function parseArgs(argv) {
  let runs = 3;
  for (const a of argv) {
    if (a.startsWith("--runs=")) runs = Number.parseInt(a.slice("--runs=".length), 10);
  }
  return { runs };
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
  const sorted = [...nums].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
}

function appendToGroup(byId, records) {
  for (const r of records) {
    if (!byId.has(r.id)) byId.set(r.id, []);
    byId.get(r.id).push(r);
  }
}

function groupRecordsById(docs) {
  const byId = new Map();
  for (const doc of docs) appendToGroup(byId, doc.records);
  return byId;
}

function aggregateSamples(samples) {
  const first = samples[0];
  return {
    ...first,
    medianMs: median(samples.map((s) => s.medianMs)),
    p95Ms: median(samples.map((s) => s.p95Ms)),
    throughputMbPerS: median(samples.map((s) => s.throughputMbPerS)),
    perChunkMedianMs:
      first.perChunkMedianMs === undefined
        ? undefined
        : median(samples.map((s) => s.perChunkMedianMs ?? 0)),
    heapUsedBytes: median(samples.map((s) => s.heapUsedBytes)),
  };
}

function combineRecords(docs) {
  const byId = groupRecordsById(docs);
  const combined = [];
  for (const [, samples] of byId) {
    combined.push(aggregateSamples(samples));
  }
  return combined;
}

const { runs } = parseArgs(process.argv.slice(2));
console.log(`Running benchmark capture ${runs} time(s)…`);

// Ensure the parser, renderers, and plugins are built first — the
// structured bench sections import dist/ from sibling packages.
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

const docs = [];
for (let i = 0; i < runs; i++) {
  console.log(`  run ${i + 1}/${runs}`);
  docs.push(runCapture());
}

const first = docs[0];
const baseline = {
  schemaVersion: first.schemaVersion,
  capturedAt: new Date().toISOString(),
  node: first.node,
  platform: first.platform,
  runs,
  records: combineRecords(docs),
};

const outPath = join("packages", "bench", "baseline.json");
writeFileSync(outPath, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`\nWrote ${baseline.records.length} records → ${outPath}`);
