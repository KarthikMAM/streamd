<!--
Thanks for opening a PR. Keep the checklist below — the CI gate blocks
anything that skips a box without replacing it with the matching
reasoning.

Steering: see .kiro/steering/code-quality-checklist.md for the full list.
-->

## What

<!-- Short prose: what does this change accomplish? 1–3 sentences. -->

## Why

<!-- Motivation. Link tickets / issues / discussions. -->

## How

<!-- Key technical decisions. Anything that would surprise a reviewer. -->

## Public API impact

- [ ] No public type / function signature changes
- [ ] Additive only — no removals or renames
- [ ] Breaking change — includes a changeset with a `major` bump + migration note

## Packages touched

<!-- Tick every applicable box. This determines the reviewers via CODEOWNERS. -->

- [ ] `@streamd/parser`
- [ ] `@streamd/tokens`
- [ ] `@streamd/html`
- [ ] `@streamd/react`
- [ ] `@streamd/react-native`
- [ ] `@streamd/plugins`
- [ ] `@streamd/bench` / `@streamd/spec` / `@streamd/e2e` / `@streamd/config`
- [ ] `apps/*` (demo app)
- [ ] CI / governance / docs only

## Steering-rule self-check

Complete before requesting review.

### Documentation
- [ ] Every new / modified function has a JSDoc with purpose + `@param` + `@returns` + `@throws`
- [ ] Every new / modified type has a JSDoc
- [ ] No `// TODO` / `// HACK` without a linked ticket
- [ ] No commented-out blocks >3 lines

### Safety & correctness
- [ ] No `any`, no non-null `!`, no `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`
- [ ] No `console.*` outside `apps/`, `scripts/`, `bench/`
- [ ] No magic numbers / strings — named constants only
- [ ] Every `switch` on a finite union throws in `default`
- [ ] Every public API boundary validates its inputs and throws a named error

### Structure
- [ ] Functions ≤ 20 lines of logic, ≤ 1 nesting level
- [ ] Cognitive complexity ≤ 8 per function (Biome enforces)
- [ ] Types centralized in the package's `types.ts`

### Testing
- [ ] New / changed behaviour has a unit test
- [ ] No `.only` / `.skip` / `fit` / `fdescribe` (CI blocks it)
- [ ] `npm run test` passes locally
- [ ] `npm run test:coverage` passes thresholds (CI checks)

### Governance
- [ ] Changeset attached when a public package changes (`npx changeset`)
- [ ] `npm run lint` clean
- [ ] `npm run check:banned` clean
- [ ] `npm run typecheck` clean
- [ ] Bundle size budget respected (size-limit)
