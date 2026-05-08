---
inclusion: always
---

# Testing Standards — `@streamd/*`

Every test in every package must follow these rules. Tests exist to
protect behaviour, not to pad coverage. A passing test with no
meaningful assertion is worse than no test — it burns CI time and
creates false confidence.

Related steering:
- [`parser-conventions.md`](parser-conventions.md) — parser-specific
  testing hard-constraints (direct imports, no integration through
  `@streamd/parser`, 95% statement / 85% branch target).
- [`parser-design.md`](parser-design.md) — streaming contract; the
  speculative-tail invariant that parser tests verify.
- [`STYLE.md`](../../STYLE.md) — rule-to-enforcement mapping.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — the short checklist
  contributors see first.

---

## 1 — File Structure and Naming

- **Location**: tests mirror source. `foo.ts` has a companion
  `foo.test.ts` in the same directory. Cross-module integration
  tests go in `packages/e2e/`.
- **Extension**: `.test.ts` / `.test.tsx`. No `.spec.ts`.
- **Module JSDoc mandatory**: every test file opens with
  `/** ... @module <path>.test */`. One sentence stating the scope
  of the file.
- **One source unit per test file**: `foo.test.ts` tests `foo.ts`
  only. Cross-module interactions go in `packages/e2e/` or a
  package's `integration.test.ts`.
- **Direct imports**: import the function under test directly from
  the source module. Do not import via the package's public entry
  (`@streamd/foo`) — that's an integration test, not a unit test.
  See [`parser-conventions.md`](parser-conventions.md) §"Testing
  Standards".

---

## 2 — Test Structure (AAA)

Every test follows Arrange → Act → Assert:

```ts
it("rewrites javascript: href to the fallback anchor", () => {
  // Arrange
  const tokens = parse("[bad](javascript:alert(1))\n").tokens;

  // Act
  const out = applyPlugins(tokens, [sanitize()]).tokens;

  // Assert
  expect(findLink(out).href).toBe("#");
});
```

- **One behaviour per test.** Multiple assertions on the same output
  are fine; multiple independent outputs are not.
- **Max 20 lines per test body.** If it needs more, extract a
  factory / arrange-helper.
- **No conditional assertions.** `if (x) expect(...)` is a branching
  test — split into two tests, one per branch.

---

## 3 — Naming

| Symbol | Convention | Example |
|---|---|---|
| `describe` block | Symbol under test or behaviour group | `describe("scanDelimiterRun — flanking", …)` |
| `it` block | Present-tense behaviour statement | `it("returns count=2 for two consecutive stars", …)` |

Rules:

- **`it()` names state a fact, not an expectation.** Prefer present
  tense (`"returns …"`, `"throws …"`, `"emits …"`). Avoid the
  `should …` prefix — it's weaker than stating the contract.
- **`it()` names name the input and the expected outcome.** Not
  "works with empty string", but "returns an empty string when the
  input is empty".
- **Banned names**: `"works"`, `"handles X correctly"`, `"case 1"`,
  `"basic test"`.

---

## 4 — Assertions

### Every test has at least one meaningful assertion

A test without `expect(...)` passes silently — it's a defect. One
assertion per test is the floor; verify every piece of the output
your behaviour statement implies.

### Prefer specific matchers over loose ones

| Output shape | Preferred matcher |
|---|---|
| Primitive | `toBe(literal)` |
| Object structure | `toEqual({...})` |
| Exact equality incl. prototype / undefined fields | `toStrictEqual({...})` |
| String shape | `toMatch(/regex/)` or `toContain("substr")` |
| Thrown error | `toThrow(ClassOrMatcher)` |
| Rejected promise | `rejects.toThrow(...)` |
| Array contents regardless of order | `toEqual(expect.arrayContaining([...]))` |

### Banned as the sole assertion

- `toBeDefined()` on a value whose specific shape is known — use the
  concrete matcher. `toBeDefined()` passes for `0`, `""`, `false`.
- `toBeTruthy()` / `toBeFalsy()` on non-boolean values — they coerce
  and hide bugs.
- `toBeNull()` / `not.toBeNull()` as the only check — if the test
  name promises a specific value, assert that value.
- `toHaveBeenCalled()` without also verifying the SUT's observable
  output (§7).

### No tautologies

- `expect(true).toBe(true)`, `expect(obj).toEqual(obj)`, any
  assertion whose left and right sides are computed by the SUT
  itself.
- `expect(typeof themes.lightTheme).toBe("object")` on a typed
  module export — TypeScript already guarantees the type.
- `expect(Array.isArray(tokens)).toBe(true)` on a typed array.

### No unsafe optional-chain assertions

```ts
// WRONG — if result is null, result?.count is undefined,
// and expect(undefined).toBe(2) fails with a bad error message.
const result = scanDelimiterRun("**foo", 0, 5);
expect(result?.count).toBe(2);

// RIGHT — assert non-null first, then narrow.
const result = scanDelimiterRun("**foo", 0, 5);
expect(result).not.toBeNull();
// biome-ignore lint/style/noNonNullAssertion: asserted above
expect(result!.count).toBe(2);
```

Non-null assertions (`!`) are banned in production (Biome enforces
`style/noNonNullAssertion: error`) but permitted in tests on the
very next line after a `toBeNull` / `toBeDefined` guard, with a
`biome-ignore` referencing the guard.

---

## 5 — Error Assertions (Canonical Form)

Use vitest's built-in matchers. The hand-rolled `try/catch + return;
throw new Error("expected throw")` and `try/catch + expect.fail(...)`
patterns are banned.

```ts
// WRONG — hand-rolled, fragile
try {
  parseCliArgs(["--nope"]);
} catch (err) {
  const e = err as StreamdCliArgumentError;
  expect(e.kind).toBe("unknown-flag");
  return;
}
throw new Error("expected throw");

// RIGHT — single expression, class + fields checked
expect(() => parseCliArgs(["--nope"])).toThrow(StreamdCliArgumentError);
expect(() => parseCliArgs(["--nope"])).toThrow(
  expect.objectContaining({ kind: "unknown-flag" }),
);
```

For async errors:

```ts
await expect(fn()).rejects.toThrow(ClassOrMatcher);
```

The `expect(() => fn()).toThrow(...)` form invokes the SUT twice
(once per assertion). When using `vi.fn().mockImplementationOnce(...)`,
switch to `mockImplementation(...)` so both invocations see the same
mock behaviour.

---

## 6 — Tautology and Vacuous-Test Detection

A test is vacuous if any of the following hold:

- It contains no `expect(...)` call.
- Every `expect` is a tautology (left and right sides both derived
  from SUT output).
- The test's assertion would pass even if the SUT returned a fixed
  constant (e.g. `expect(typeof x).toBe("object")` for any function
  returning an object).
- The test exercises code but asserts nothing about what that code
  did (e.g. `sut(); expect(true).toBe(true)` — runs for coverage
  only).
- The test asserts only that a mock was called, without tying the
  call to an observable behaviour of the SUT.
- **The assertion checks for substrings that also appear literally
  in the test input.** `toContain("em")` on markdown source
  `"*em*"` passes even if the renderer emits plain text — the "em"
  substring is already in the source and the renderer only strips
  the `*` characters. Coverage-driven test additions are a known
  source of this pattern.
- **The test title describes behaviour the test body does not
  verify.** A test named "invoked on press" whose body asserts the
  callback was NOT invoked is worse than fluff — it lies. Either
  make the body verify what the title claims, rename the title, or
  delete the test.

Vacuous tests must be rewritten or deleted. Deleting is better than
keeping — a rewritten-but-still-vacuous test is worse than no test.

The question to ask of every test:

> *"If the SUT were silently broken, would this test fail?"*

If the answer is "no" or "maybe", rewrite the test.

---

## 7 — Test Doubles (Stubs, Mocks, Spies)

- **Prefer stubs over mocks.** A stub returns canned data; a mock
  verifies interaction. Stubs couple less.
- **Never self-mock.** `vi.mock("./foo")` inside `foo.test.ts` is
  banned — you end up testing the mock, not the code.
- **Every mock interaction assertion must pair with an output
  assertion.** `expect(spy).toHaveBeenCalledWith(id)` alone does not
  test the SUT — add an assertion on what the SUT returned or
  emitted.
- **Cache contracts are an exception.** Asserting
  `createHighlighter` was called once (for cache hit) vs. twice (for
  cache miss) IS the observable contract — there's no other way to
  test a cache.
- **Mock at the boundary, not in the middle.** Mock the network
  adapter, not the service layer. Middle-layer mocks fossilise
  implementation details.
- **No real I/O in unit tests.** No network, no filesystem reads
  outside fixtures, no databases. Integration tests belong in
  `packages/e2e/`.

---

## 8 — Independence and Determinism

- Tests pass in any order. No shared mutable module-level fixtures.
- No `Date.now()`, `Math.random()`, timezone-dependent behaviour
  without `vi.useFakeTimers()` or a seeded value.
- No `setTimeout` / `setInterval` for sync behaviour. Use
  `vi.runAllTimers()` with fake timers if time matters.
- No network, no filesystem writes outside test-scoped temp dirs.
- **Flaky tests are bugs.** No `.retry()`, no "run it 3 times". Fix
  the root cause.

---

## 9 — Fixtures

- **Inline fixtures for one-use data.** If the markdown source or
  object literal is only used by one test, define it inline.
- **Named factories for shared data.** `makeUser({ name: "x" })`
  beats a top-level `const USER = {...}` — mutations can't leak
  between tests.
- **Never share mutable fixtures.** Every test builds its own via a
  factory.
- **Intent-named, not index-named.** `ORDERED_LIST_WITH_START_5`
  beats `case1`.

---

## 10 — Coverage Philosophy

Coverage is a **floor**, not a ceiling. Thresholds are set
per-package in `packages/<pkg>/vitest.config.ts` (or via the shared
base config in `packages/config/vitest.ts`). **Meaningful tests** is
the ceiling you aim for.

- **100% coverage with vacuous tests is worthless.** A new helper
  is better served by three contract-asserting tests and 80%
  coverage than ten `sut(); expect(true).toBe(true)`-pattern tests
  and 100%.
- **Every public function gets at least one happy-path test and one
  invalid-input test.**
- **Every documented `@throws` has a dedicated test** asserting the
  throw class and discriminator.
- **Every boundary case in the function's doc comment** has a test.
  The doc is the contract; tests are the contract's enforcement.

### Excluded from coverage by design

The shared base config excludes these paths because they have no
unit-testable runtime semantics:

- `**/types.ts`, `**/types/**` — type-only modules; TS erases them.
- `**/messages.ts` — string-constant error-message lookups, covered
  via the throw sites that reference them.
- `**/src/index.ts` — public-API barrel files. Tests import from
  concrete modules (§1), so the barrel reports 0% spuriously.

---

## 11 — Banned Patterns

- `console.log` / `console.error` inside tests — produces noise.
- `.only` committed to mainline — causes silent test-suite
  shrinkage.
- `xit` / `xdescribe` / `it.skip` / `describe.skip` without a TODO
  or tracking reference. For spec-conformance skips, see
  [`packages/spec/src/skip.ts`](../../packages/spec/src/skip.ts) —
  those are classified and centrally tracked.
- Empty test bodies — `it("x", () => {})`.
- Snapshot tests without a rationale comment — snapshots hide the
  regression direction. Prefer structural assertions unless the
  output is large and well-characterised.
- `if (condition) throw new Error("expected throw")` — use
  `expect.fail(...)` inside a dedicated property-based aggregate
  reporter (see `packages/e2e/src/fuzzer/run.test.ts` for the one
  legitimate use), or restructure as `expect(() => ...).toThrow()`.
- Tests that inspect private state via `// @ts-expect-error` — the
  private state isn't the contract; the public output is.

---

## 12 — Helpers

- **Local helpers live at the bottom of the test file**, below all
  `describe` blocks.
- **Every helper has a doc comment.** Helpers are still code.
- **Cross-file helpers go in `src/test-utils.ts`** inside the
  package, or `packages/e2e/` for cross-package use.
- **No dynamic imports, no filesystem reads** from helpers.
- **Helper names are verb phrases** (`makeBlockquote`,
  `renderMarkdown`, `findLink`). Banned: `helper`, `utils`,
  `setup`.

---

## 13 — Pre-commit Checklist

When writing or reviewing tests:

- [ ] File has `@module` JSDoc header
- [ ] Every `it()` name states a specific behaviour (no "works", no
      "handles X")
- [ ] Every test has at least one concrete `expect(...)` (§4)
- [ ] No tautologies (§6)
- [ ] Error tests use `toThrow(...)`, not try/catch (§5)
- [ ] No unsafe optional-chain assertions (§4)
- [ ] No self-mocks, no mid-layer mocks (§7)
- [ ] No real I/O, no timing-dependent logic without fake timers (§8)
- [ ] No `.only` / `.skip` without a tracking reference (§11)
- [ ] Helper functions have doc comments (§12)
- [ ] Test bodies ≤ 20 lines (§2)
- [ ] Would this test fail if the SUT were silently broken? (§6)

---

## History

This file codifies the test-quality standards applied during the
**2026-05 eight-pass test audit** which eliminated 88 antipattern
sites (try/catch+throw, loose `toBeGreaterThan(0)`, vacuous
`toBeDefined`, mock-call-only, substring-in-source `toContain`,
lying titles) across the monorepo and lifted coverage from 94-98%
per package into the 96-100% range while keeping every test
meaningful.
