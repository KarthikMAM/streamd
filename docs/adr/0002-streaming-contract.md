# ADR 0002: Streaming contract — `stableCount` + prefix immutability

- **Status:** Accepted
- **Date:** 2026-05
- **Deciders:** @KarthikMAM
- **Affects:** `@streamd/parser`, `@streamd/html` (streaming API),
  `@streamd/react` (`useStreamingMarkdown` hook),
  `@streamd/react-native` (`useStreamingMarkdown` hook).

## Context

The primary use case for `streamd` is rendering LLM output as it
streams in. Re-rendering the entire token tree on every character would
be correct but wasteful — React would re-reconcile all children on every
frame, tanking input responsiveness on long responses.

The parser needs to tell the consumer *which tokens are done changing*
so the renderer can mount them once and never touch them again.

## Decision

Every `parse(src, state?)` call returns a `ParseResult` with a
`stableCount: number`. Consumers rely on three guarantees:

1. **Stable prefix.** `tokens[0..stableCount]` will be byte-identical
   (structurally) across every subsequent streaming call, for any input
   that extends the current source.

2. **Monotonic growth.** Across streaming calls (i.e. after the first
   `parse(src, null)` fullParse), `stableCount` never decreases. A
   token that reached the stable prefix never un-stabilizes.

3. **Progressive convergence.** Feeding source character-by-character
   and calling `parse(acc, state)` at each step converges on the same
   token tree as a single `parse(fullSrc)` call.

The first call (`state === null`) is fullParse semantics — every token
is treated as stable, and renderers that key on `stableCount` will
mount everything in one shot. Subsequent streaming calls reserve the
final block as speculative.

These invariants are enforced by the
`packages/e2e/src/streaming-invariants.test.ts` suite — a regression
there blocks CI.

## Consequences

### Positive

- React renderers can `useMemo` on `tokens[0..stableCount]` with
  confidence that the memo keys are stable — no accidental
  invalidation.
- Renderers can safely skip diffing the stable prefix entirely. HTML
  streaming can emit `tokens[0..stableCount]` once and only re-render
  the speculative tail, cutting allocations by ~80% on long responses.

### Negative

- Any parser change that affects the stability boundary (e.g. adding a
  new speculative block kind) needs a corresponding update to the
  streaming-invariants tests. The contract is part of the public API
  and changing it requires a major version bump.

### Neutral

- The first-call special case (fullParse with everything stable) has
  led to one-off misinterpretations. Test suites that check
  monotonicity must skip index 0.

## Alternatives considered

### Return only the delta since last call
Rejected. Consumers still need the full tree to render — shipping
deltas would shift the reassembly burden into every downstream renderer
and require each to reimplement the token-identity logic.

### Emit a version number per token
Rejected. Adds per-token memory overhead and doesn't give the React
renderers what they need (a contiguous stable prefix). The
`stableCount` scheme is strictly less expensive and carries the same
information.

## References

- `packages/e2e/src/streaming-invariants.test.ts` — the invariant test
  suite.
- `packages/e2e/src/streaming-equivalence.test.ts` — the
  streaming-vs-one-shot equivalence suite.
- `.kiro/steering/parser-design.md` — original design doc.
