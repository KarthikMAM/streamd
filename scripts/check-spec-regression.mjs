#!/usr/bin/env node
/**
 * Spec conformance regression guard.
 *
 * Runs the `@streamd/spec` vitest suite with the JSON reporter,
 * extracts a per-test `(suite, fixture, status)` map, and compares
 * against the committed baseline at `packages/spec/baseline.json`.
 *
 * Fails on:
 *   1. Any fixture that was `passed` in baseline and is now `failed`
 *      or missing (classic regression).
 *   2. Any fixture that was `skipped` in baseline and is now `failed`
 *      (substitution regression — the skip was removed but the
 *      underlying divergence remains, so the test is now a hard fail
 *      instead of a silent skip).
 *   3. The overall pass count dropping below baseline.
 *
 * Warns (exit 0) on:
 *   - Any fixture that was `skipped` in baseline and is now `passed`
 *     (celebratory — consider removing the entry from `skip.ts`).
 *
 * Usage:
 *   node scripts/check-spec-regression.mjs            # check mode
 *   node scripts/check-spec-regression.mjs --write    # (re)write baseline.json
 *
 * @module scripts.check-spec-regression
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Directory layout. */
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const SPEC_PKG = join(REPO_ROOT, "packages", "spec");
const BASELINE_PATH = join(SPEC_PKG, "baseline.json");

/** CLI flags. */
const ARGS = new Set(process.argv.slice(2));
const SHOULD_WRITE = ARGS.has("--write");

/**
 * Run the spec vitest suite with the JSON reporter and return the
 * parsed report. Uses a tmp directory so concurrent runs don't fight
 * for the same output path.
 */
function runSpecSuite() {
  const tmp = mkdtempSync(join(tmpdir(), "spec-regression-"));
  const outFile = join(tmp, "spec-report.json");
  try {
    execFileSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${outFile}`], {
      cwd: SPEC_PKG,
      stdio: ["inherit", "pipe", "pipe"],
      encoding: "utf-8",
    });
    return JSON.parse(readFileSync(outFile, "utf-8"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Normalize one vitest JSON report into `{ suiteName → { fixture →
 * status } }`. `status` is one of "passed" | "failed" | "skipped".
 */
function reportToSuites(report) {
  const suites = {};
  for (const testFile of report.testResults ?? []) {
    for (const assertion of testFile.assertionResults ?? []) {
      const suiteName = (assertion.ancestorTitles ?? [])[0] ?? "unknown";
      const fixture = assertion.title;
      if (!suites[suiteName]) suites[suiteName] = {};
      suites[suiteName][fixture] = assertion.status;
    }
  }
  return suites;
}

/**
 * Build the full baseline payload — wraps suites plus totals.
 */
function buildBaseline(suites) {
  const totals = {};
  for (const [suiteName, tests] of Object.entries(suites)) {
    const counts = { passed: 0, failed: 0, skipped: 0, total: 0 };
    for (const status of Object.values(tests)) {
      counts.total++;
      if (status === "passed") counts.passed++;
      else if (status === "failed") counts.failed++;
      else if (status === "skipped") counts.skipped++;
    }
    totals[suiteName] = counts;
  }
  return { totals, suites };
}

/**
 * Load baseline.json. Returns null if the file is missing — the
 * caller handles that as "first run, write baseline".
 */
function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
}

/**
 * Classify a single test transition.
 *
 * Returns a tag from:
 *   "regression"   — baseline passed, current failed or missing.
 *   "skip-to-fail" — baseline skipped, current failed.
 *   "skip-to-pass" — baseline skipped, current passed (celebratory).
 *   "new-pass"     — not in baseline, currently passed.
 *   "new-fail"     — not in baseline, currently failed.
 *   "new-skip"     — not in baseline, currently skipped.
 *   "unchanged"    — same status as baseline.
 */
function classifyTransition(baseStatus, curStatus) {
  if (baseStatus === undefined) {
    if (curStatus === "passed") return "new-pass";
    if (curStatus === "failed") return "new-fail";
    return "new-skip";
  }
  if (curStatus === undefined) {
    if (baseStatus === "passed") return "regression";
    return "unchanged";
  }
  if (baseStatus === "passed" && curStatus === "failed") return "regression";
  if (baseStatus === "skipped" && curStatus === "failed") return "skip-to-fail";
  if (baseStatus === "skipped" && curStatus === "passed") return "skip-to-pass";
  return "unchanged";
}

/**
 * Compare current suites to baseline suites. Returns arrays of
 * regressions / warnings / count-drops for the reporter.
 */
function compareSuites(baseline, current) {
  const regressions = [];
  const skipToFails = [];
  const skipToPasses = [];
  const countDrops = [];
  const allSuites = new Set([...Object.keys(baseline.suites), ...Object.keys(current.suites)]);
  for (const suiteName of allSuites) {
    const baseTests = baseline.suites[suiteName] ?? {};
    const curTests = current.suites[suiteName] ?? {};
    const basePassed = baseline.totals[suiteName]?.passed ?? 0;
    const curPassed = current.totals[suiteName]?.passed ?? 0;
    if (curPassed < basePassed) {
      countDrops.push({ suite: suiteName, from: basePassed, to: curPassed });
    }
    const fixtures = new Set([...Object.keys(baseTests), ...Object.keys(curTests)]);
    for (const fixture of fixtures) {
      const tag = classifyTransition(baseTests[fixture], curTests[fixture]);
      if (tag === "regression") {
        regressions.push({
          suite: suiteName,
          fixture,
          was: baseTests[fixture],
          now: curTests[fixture],
        });
      } else if (tag === "skip-to-fail") {
        skipToFails.push({ suite: suiteName, fixture });
      } else if (tag === "skip-to-pass") {
        skipToPasses.push({ suite: suiteName, fixture });
      }
    }
  }
  return { regressions, skipToFails, skipToPasses, countDrops };
}

/**
 * Emit a human-readable comparison report to stdout / stderr.
 */
function printReport(cmp, baseline, current) {
  console.log("Spec conformance regression check");
  console.log("─".repeat(50));
  for (const suiteName of Object.keys(current.totals).sort()) {
    const base = baseline.totals[suiteName] ?? { passed: 0, total: 0 };
    const cur = current.totals[suiteName];
    console.log(
      `  ${suiteName}: ${cur.passed} / ${cur.total} passed  (baseline ${base.passed} / ${base.total})`,
    );
  }
  console.log("");
  for (const warn of cmp.skipToPasses) {
    console.log(
      `  [WARN] ${warn.suite} / ${warn.fixture}: was skipped in baseline, now passing. Consider removing from skip.ts.`,
    );
  }
  if (cmp.skipToPasses.length > 0) console.log("");
}

/**
 * Emit all FAIL lines to stderr. Returns true when anything failed.
 */
function printFailures(cmp) {
  let anyFailed = false;
  for (const r of cmp.regressions) {
    anyFailed = true;
    const now = r.now ?? "missing";
    console.error(`  [FAIL] ${r.suite} / ${r.fixture}: was ${r.was} in baseline, now ${now}.`);
  }
  for (const s of cmp.skipToFails) {
    anyFailed = true;
    console.error(
      `  [FAIL] ${s.suite} / ${s.fixture}: was skipped in baseline, now failing (expected to pass after removal from skip list).`,
    );
  }
  for (const d of cmp.countDrops) {
    anyFailed = true;
    console.error(`  [FAIL] ${d.suite}: pass count dropped (${d.from} → ${d.to}).`);
  }
  return anyFailed;
}

/**
 * Write baseline.json from the current suites payload. Sorts keys so
 * diffs are minimal across regenerations.
 */
function writeBaseline(baseline) {
  const sortedSuites = {};
  for (const suiteName of Object.keys(baseline.suites).sort()) {
    const sortedTests = {};
    for (const fixture of Object.keys(baseline.suites[suiteName]).sort()) {
      sortedTests[fixture] = baseline.suites[suiteName][fixture];
    }
    sortedSuites[suiteName] = sortedTests;
  }
  const payload = { totals: baseline.totals, suites: sortedSuites };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  console.log(`Wrote ${BASELINE_PATH}`);
}

/**
 * Top-level driver.
 */
function main() {
  console.log("Running spec suite…");
  const report = runSpecSuite();
  const suites = reportToSuites(report);
  const current = buildBaseline(suites);

  if (SHOULD_WRITE) {
    writeBaseline(current);
    console.log("check-spec: baseline refreshed");
    return;
  }

  const baseline = loadBaseline();
  if (!baseline) {
    console.error(`Baseline not found at ${BASELINE_PATH}.`);
    console.error("Create it first with:  node scripts/check-spec-regression.mjs --write");
    process.exit(1);
  }

  const cmp = compareSuites(baseline, current);
  printReport(cmp, baseline, current);
  const anyFailed = printFailures(cmp);

  if (anyFailed) {
    console.error(
      "\nSpec compliance regressed. Either fix it or refresh the baseline with --write.",
    );
    process.exit(1);
  }

  console.log("check-spec: clean");
}

main();
