# Contributing to streamd

Thanks for the interest. This repo is a TypeScript monorepo managed with
`turbo`, `npm` workspaces, and `biome`.

## Before you start

1. Read [`STYLE.md`](STYLE.md) — every rule there is auto-enforced, so
   a change that violates them won't even pass pre-commit.
2. Read the design doc in
   [`.kiro/steering/parser-design.md`](.kiro/steering/parser-design.md)
   if you're touching `@streamd/parser`. It captures the streaming
   invariants and performance exceptions the parser depends on.
3. Skim `README.md` for the high-level layout.

## Workflow

```bash
git clone https://github.com/KarthikMAM/streamd.git
cd streamd
npm install
npm run ci          # baseline — should be green before you start
```

Make your change, then:

```bash
npm run lint:fix    # auto-format + apply biome autofixes
npm run check:banned
npm run typecheck
npm run test
```

Use `npx changeset` to add a changeset describing your change. CI uses
the changeset to decide package version bumps.

## Commit messages

Commits follow [Conventional
Commits](https://www.conventionalcommits.org/) via `commitlint`. Format:

```
<type>(<scope>): <subject>
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`,
`perf`, `style`, `build`, `ci`.

Subject is lowercase, imperative, no trailing period, max 72 chars.

## Opening a PR

- PR title follows the same Conventional Commit format.
- Fill out the PR template — every checkbox is a gate.
- CI must be green. If a check is flaky, fix the root cause; don't
  rerun until it passes.
- Include `a changeset` (via `npx changeset`) for any user-facing
  change.

## Testing rules

Every test in every package follows
[`.kiro/steering/testing-standards.md`](.kiro/steering/testing-standards.md).
Quick summary — the full rulebook covers AAA structure, behaviour-first
naming, canonical `toThrow` error assertions, tautology detection, test
doubles policy, fixtures, and the pre-commit checklist.

- File layout: `foo.ts` has a companion `foo.test.ts` in the same
  directory. Cross-module integration tests live in `packages/e2e/`.
  Import the SUT directly from the source module, not through the
  package's public entry point.
- Every test file opens with a `@module` JSDoc header stating its
  scope.
- Every `it()` name states a specific behaviour (`"returns count=2 for
  two consecutive stars"`). No `"should …"` prefix, no `"works"`, no
  `"handles X correctly"`.
- Every test has at least one meaningful `expect(...)`. Tautologies
  (`expect(true).toBe(true)`, `expect(x).toEqual(x)`) and vacuous
  tests (`sut(); expect(true).toBe(true)` for coverage only) are
  defects, not tests.
- Error assertions use `expect(() => fn()).toThrow(ClassOrMatcher)` —
  never the hand-rolled `try/catch + return; throw new Error("expected
  throw")` or `try/catch + expect.fail(...)` patterns.
- No test interdependence. Each test sets up and tears down its own
  state.
- No network calls, file I/O, or database access in unit tests. Mock
  at the boundary. Prefer dependency injection over module-level
  mocking.
- Prefer stubs over mocks. Every mock-interaction assertion must pair
  with an observable-output assertion on the SUT. The cache-contract
  exception is documented in
  [`testing-standards.md`](.kiro/steering/testing-standards.md) §7.
- Test data is constructed in the test or in a named factory/builder.
  No shared mutable fixtures.
- Flaky tests are bugs. Fix the root cause; don't retry.

See [`testing-standards.md`](.kiro/steering/testing-standards.md) for
the full rulebook and the pre-commit enforcement checklist.

## Performance exceptions

Some steering rules are relaxed in documented hot-path files (parser
internals, renderer walk loops). Do not expand the override list
without a measured justification; see the second override in
[`biome.json`](biome.json) and the per-file `@module` docstrings that
explain why each exception exists.

## Reviewing a PR

- Confirm CI is green.
- Confirm the changeset matches the change's impact.
- Read [STYLE.md](./STYLE.md) once per review — it maps each steering rule
  to its mechanical enforcement, and the `Code-Quality Self-Review` block in
  the PR template summarises what reviewers gate on.

## Releasing

Maintainers only. The `Release` workflow publishes tags and packages
when a changeset PR is merged to `main`.
