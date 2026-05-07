# ADR 0001: Parser performance exceptions from the code-quality rulebook

- **Status:** Accepted
- **Date:** 2026-05
- **Deciders:** @KarthikMAM
- **Affects:** `@streamd/parser`

## Context

The code-quality steering rulebook (see `STYLE.md`) enforces strict
limits across every package: cognitive complexity ≤ 8, no non-null
assertions, `useForOf` for array iteration, no flat switch dispatch,
no numeric-literal dispatch tables, etc.

Streaming markdown parsing has hard performance requirements. The
parser runs on every keystroke in an LLM response — per-call overhead
compounds linearly with token count. Measured on representative
fixtures (see `packages/bench`):

- `for…of` adds ~12% to hot loops vs index-based `for`.
- Non-null assertions after an `arr[i]` access with a preceding
  `arr.length` check save a bounds re-check that the engine can't
  always eliminate.
- Flat switch on `TokenType` compiles to a jump table; extracting
  branches into helpers introduces call-frame overhead.

These rules exist for maintainability in business-logic code where
per-call overhead is invisible. In the parser hot path they directly
regress a headline benchmark.

## Decision

`packages/parser/src/**` is exempted from the following biome rules
via `biome.json` overrides:

- `style/useForOf`
- `style/noNonNullAssertion`
- `complexity/noExcessiveCognitiveComplexity`
- `complexity/useSimplifiedLogicExpression`
- `style/noDefaultSwitchClause`
- `style/useNamingConvention`

The specific rationale for each exception is documented as a header
comment in every exempt file. If any future maintainer wants to remove
the exception, they must produce a benchmark showing the replacement
meets the perf floor in `packages/bench/baseline.json`.

## Consequences

### Positive

- Parser hot path preserves the ~110 MB/s single-shot parse rate and
  the ~35 MB/s per-character streaming rate measured on the `bench:*`
  suite.
- Design intent is codified — a reviewer sees the override block and
  understands why the parser diverges from the rest of the monorepo.

### Negative

- The parser reads differently from the other packages. New contributors
  need to learn both styles.
- A genuinely buggy non-null assertion in the parser could mask a crash
  as undefined behaviour. Mitigated by the 509 parser unit tests plus
  the 1388 CommonMark + GFM spec fixtures running on every CI run.

### Neutral

- Renderer hot paths (`packages/html/src/render.ts`,
  `packages/react/src/components.tsx`, etc.) inherit a narrower version
  of the same exception — listed explicitly in `biome.json` override
  #2.

## Alternatives considered

### Enforce the rules uniformly
Rejected. Benchmarks regressed by ~15%. The rules are intended for
business-logic code, not a streaming parser.

### Fork the steering rules into a `parser-specific.md`
Rejected. A separate ruleset is harder to keep in sync and obscures the
fact that every other rule in the main rulebook does apply.

## References

- `STYLE.md` — maps every steering rule to its enforcement.
- `.kiro/steering/parser-conventions.md` §3.2 — performance-critical
  conventions for parser code.
- `.kiro/steering/parser-design.md` — the parser's architecture
  document, which pre-committed to these trade-offs.
