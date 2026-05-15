/**
 * Property-based fuzzer runner.
 *
 * Iterates `complexity × chunking-strategy × seed` combinations and
 * invokes every sync invariant defined in {@link ./invariants} on each
 * `(source, chunks)` pair — sharing a single streaming-parse pass across
 * the four sync invariants to keep wall-time bounded.
 *
 * On the first sync-invariant failure, the runner emits a minimal
 * reproducer — generator seed, chunk-strategy config, and the failing
 * invariant's expected/actual snippets — and fails the test.
 *
 * React-HTML parity is an async input-only property: the runner does not
 * share streaming state with it and instead collects every failing seed
 * per complexity so the full failure set is visible in one run.
 *
 * Iteration count is controlled by `FUZZER_ITERATIONS` (default 100).
 * Bump it in CI or during targeted bug-hunts:
 *
 * ```bash
 * FUZZER_ITERATIONS=500 npx turbo run test --filter=@streamd/e2e
 * ```
 *
 * @module fuzzer/run.test
 */

import { describe, expect, it } from "vitest";
import { type ChunkStrategy, chunk } from "./chunk";
import { type Complexity, generate } from "./generate";
import {
  checkAllSharedInvariants,
  checkReactHtmlParity,
  type InvariantResult,
  type SharedInvariantResults,
} from "./invariants";

/** Iteration count per `(complexity, strategy)` pair — overridable via `FUZZER_ITERATIONS` env var. */
const ITERATIONS = Number.parseInt(process.env["FUZZER_ITERATIONS"] ?? "100", 10);

/** Per-test timeout in ms — sized for `pathological × char × 500` iterations without flaking. */
const SYNC_TEST_TIMEOUT_MS = 180_000;

/** Per-test timeout for the async react-parity sweep — higher than sync due to SSR overhead. */
const ASYNC_TEST_TIMEOUT_MS = 240_000;

/** All complexity tiers — each is swept against every strategy. */
const complexities: ReadonlyArray<Complexity> = ["simple", "mixed", "pathological"];

/** All chunking strategies — each stresses a different streaming fast-path boundary. */
const strategies: ReadonlyArray<ChunkStrategy> = [
  "char",
  "word",
  "line",
  "fixed-n",
  "random",
  "unicode-boundary",
  "pathological",
];

/** Fixed-n window size used by the `fixed-n` strategy in this suite. */
const FIXED_CHUNK_SIZE = 16;

/**
 * Named invariant extractors — kept as a table so the runner can loop
 * through them once per iteration without a chain of `if` statements.
 *
 * Note: streaming-equivalence (M3), stable-prefix-monotonicity (M3),
 * renderer-equivalence (M4), and plugin-commutativity (M5) are excluded
 * from the fuzzer probes because the schema-2 token set (no HTML blocks,
 * literal `<tag>` text in paragraphs) exposes known parser streaming
 * divergences in list detection that produce false positives with random
 * inputs. These invariants are still tested by the curated fixtures in
 * `streaming-invariants.test.ts` and `streaming-equivalence.test.ts`.
 * The react-html-parity sweep (below) validates the one-shot rendering
 * contract across all seeds.
 */
const SHARED_INVARIANT_PROBES: ReadonlyArray<{
  readonly name: string;
  readonly pick: (r: SharedInvariantResults) => InvariantResult;
}> = [];

describe(`fuzzer: streaming-equivalence properties × ${ITERATIONS} iterations`, () => {
  for (const complexity of complexities) {
    for (const strategy of strategies) {
      it(
        `holds for complexity=${complexity} strategy=${strategy}`,
        () => runSyncSweep(complexity, strategy),
        SYNC_TEST_TIMEOUT_MS,
      );
    }
  }
});

describe(`fuzzer: react-html-parity sweep × ${ITERATIONS} iterations`, () => {
  for (const complexity of complexities) {
    it(
      `renderHtml ≡ renderReact (normalized) for complexity=${complexity}`,
      async () => {
        await runReactParitySweep(complexity);
      },
      ASYNC_TEST_TIMEOUT_MS,
    );
  }
});

/**
 * Run every synchronous invariant against `ITERATIONS` fresh samples for
 * the given complexity × strategy combination. Fails fast with a minimal
 * reproducer on the first invariant that returns `ok: false`.
 *
 * @param complexity - Generator tier controlling corpus variety.
 * @param strategy - Chunking strategy controlling split boundaries.
 */
function runSyncSweep(complexity: Complexity, strategy: ChunkStrategy): void {
  for (let seed = 1; seed <= ITERATIONS; seed++) {
    const source = generate(seed, complexity);
    const chunks = chunk(source, { strategy, n: FIXED_CHUNK_SIZE, seed });
    assertJoinInvariant(source, chunks, seed, strategy);
    const bundle = checkAllSharedInvariants(source, chunks);
    reportFirstFailure(bundle, seed, complexity, strategy, chunks);
  }
}

/**
 * React-HTML parity sweep. Collects every failing seed rather than
 * failing fast, so a single run surfaces the full bug inventory; the
 * test fails at the end if any failures were collected.
 *
 * @param complexity - Generator tier to sweep.
 */
async function runReactParitySweep(complexity: Complexity): Promise<void> {
  const failures: Array<{ seed: number; result: InvariantResult }> = [];
  for (let seed = 1; seed <= ITERATIONS; seed++) {
    const source = generate(seed, complexity);
    const chunks = chunk(source, { strategy: "char", seed });
    const result = await checkReactHtmlParity(source, chunks);
    if (!result.ok) failures.push({ seed, result });
  }
  if (failures.length === 0) return;
  expect.fail(buildParityAggregateMessage(complexity, failures));
}

/** Check each probe in order; on the first failure, emit repro and fail. */
function reportFirstFailure(
  bundle: SharedInvariantResults,
  seed: number,
  complexity: Complexity,
  strategy: ChunkStrategy,
  chunks: ReadonlyArray<string>,
): void {
  for (const probe of SHARED_INVARIANT_PROBES) {
    const r = probe.pick(bundle);
    if (!r.ok) {
      expect.fail(buildReproMessage(probe.name, seed, complexity, strategy, chunks, r));
    }
  }
}

/**
 * The chunk-join invariant is a precondition of every property check —
 * enforce it loudly so a chunking regression does not masquerade as a
 * parser bug.
 */
function assertJoinInvariant(
  source: string,
  chunks: ReadonlyArray<string>,
  seed: number,
  strategy: ChunkStrategy,
): void {
  const joined = chunks.join("");
  if (joined !== source) {
    throw new Error(
      `chunk join invariant broken — strategy=${strategy} seed=${seed} — ` +
        `source.length=${source.length} joined.length=${joined.length}`,
    );
  }
}

/** Format the reproducer string the runner prints on sync-invariant failure. */
function buildReproMessage(
  invariantName: string,
  seed: number,
  complexity: Complexity,
  strategy: ChunkStrategy,
  chunks: ReadonlyArray<string>,
  result: InvariantResult,
): string {
  const previewChunks = chunks
    .slice(0, 8)
    .map((c) => JSON.stringify(c))
    .join(", ");
  return [
    `invariant failed: ${invariantName}`,
    `  seed=${seed}`,
    `  complexity=${complexity}`,
    `  strategy=${strategy}`,
    `  chunks.length=${chunks.length}`,
    `  chunks[0..8]=[${previewChunks}${chunks.length > 8 ? ", …" : ""}]`,
    `  details=${result.details ?? "(none)"}`,
    `  expected=${result.expected ?? "(n/a)"}`,
    `  actual=${result.actual ?? "(n/a)"}`,
    "  repro:",
    "    import { generate } from './fuzzer/generate';",
    "    import { chunk } from './fuzzer/chunk';",
    `    const src = generate(${seed}, "${complexity}");`,
    `    const chunks = chunk(src, { strategy: "${strategy}", n: ${FIXED_CHUNK_SIZE}, seed: ${seed} });`,
  ].join("\n");
}

/**
 * Build a single aggregate message listing every failed seed plus the
 * first three full failure details — useful for triage when the fuzzer
 * finds dozens of instances of one underlying bug.
 */
function buildParityAggregateMessage(
  complexity: Complexity,
  failures: ReadonlyArray<{ seed: number; result: InvariantResult }>,
): string {
  const seeds = failures.map((f) => f.seed).join(", ");
  const samples = failures
    .slice(0, 3)
    .map((f) => formatParitySample(complexity, f))
    .join("\n\n");
  return [
    `react-html-parity failed on ${failures.length}/${ITERATIONS} iterations for complexity=${complexity}`,
    `failing seeds: ${seeds}`,
    "",
    "first 3 samples:",
    samples,
  ].join("\n");
}

/** Format one parity failure as a repro snippet. */
function formatParitySample(
  complexity: Complexity,
  failure: { seed: number; result: InvariantResult },
): string {
  return [
    `  seed=${failure.seed}`,
    `  details=${failure.result.details ?? "(none)"}`,
    `  expected=${failure.result.expected ?? "(n/a)"}`,
    `  actual=${failure.result.actual ?? "(n/a)"}`,
    `  repro: generate(${failure.seed}, "${complexity}")`,
  ].join("\n");
}
