# ADR 0003: Performance baseline governance

- **Status:** Accepted
- **Date:** 2026-05
- **Deciders:** @KarthikMAM
- **Affects:** `@streamd/bench`, CI pipeline, any PR touching the
  parser hot path.

## Context

The parser's hot path is the product. Streaming markdown into a React
component during LLM output is the primary use case — a 15% per-chunk
regression directly shows up as a laggier UI. Until this ADR the
bench package emitted human-readable console tables; nothing machine-
consumed those numbers and nothing gated PRs on them.

We needed a mechanism that:

1. Survives noisy CI — shared GitHub runners drift 5–15% between
   nominally identical runs.
2. Is authoritative — the committed baseline is the single source of
   truth, not a rolling average inferred from historical jobs.
3. Is cheap to update — the author of an intentional perf improvement
   should not have to hand-edit a JSON file.
4. Fails loudly but is initially opt-out — we need to calibrate
   thresholds against real CI variance before blocking merges on it.

## Decision

We commit `packages/bench/baseline.json` to the repo as the canonical
performance contract. A CI job runs the capture 3 times, takes the
median per record, and diffs against the baseline.

- **Threshold.** A record is regressed when its throughput drops by
  more than **15%** relative to the baseline. 15% is roughly 3×
  observed CI noise.
- **Non-blocking at first.** The `perf-regression` job runs with
  `PERF_REGRESSION_WARN_ONLY=1`, which prints the report and exits 0.
  We flip it to blocking after two weeks of clean signal.
- **Intentional improvements.** Authors run
  `npm run bench:baseline-update` and commit the refreshed
  `baseline.json` in the same PR that produces the improvement. The
  regeneration script runs 3 samples and takes the median, matching
  the regression gate.

The machine-readable schema is versioned (`BASELINE_SCHEMA_VERSION`).
Consumers refuse unknown versions.

## Consequences

### Positive

- PRs surface perf regressions in-band instead of months later when a
  user complains.
- The baseline commit is a normal code review — reviewers see the exact
  before/after numbers diffed in the PR.
- Memory allocation per bench is tracked in `heapUsedBytes` so leaks
  show up alongside latency regressions.

### Negative

- CI runs are ~60 seconds longer because the perf job re-runs the
  benchmarks.
- A real improvement paired with a real regression in the same PR looks
  noisy — the author must update the baseline and explain the
  trade-off in the description.

### Neutral

- Baselines are host-specific (`platform` + `node` fields record this).
  Running the same PR on a different architecture will never match
  bit-for-bit; the gate uses percent deltas instead of absolute
  values.

## Alternatives considered

### tinybench with historical storage
Rejected — pulling historical data from CI back into a PR requires
either a separate storage bucket or a third-party service. The
baseline-in-repo approach is simpler and fully auditable.

### Fail immediately on any regression
Rejected. CI noise alone produces 5–15% swings that would dominate the
signal. A 15% threshold is the minimum that keeps false-positive rate
near zero.

### Keep it informational only
Rejected. Informational output without a gate is ignored. Every
streaming CR must be measured against the contract.

## References

- `packages/bench/src/schema.ts` — versioned schema for the baseline.
- `packages/bench/src/structured-runner.ts` — canonical benchmark
  inventory.
- `packages/bench/baseline.json` — committed baseline.
- `scripts/check-perf-regression.js` — regression gate.
- `scripts/update-perf-baseline.js` — refresh script.
- `.github/workflows/ci.yml` — `perf-regression` job.
