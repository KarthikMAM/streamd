# Style Enforcement

This repo encodes the code-quality steering rules into four layered gates so
every rule is checked automatically.

## Layers

1. **`biome.json`** — lints TypeScript / JavaScript / TSX / JSX / MJS.
2. **`scripts/check-banned.sh`** — grep-based checks for rules Biome cannot
   express (banned directives, banned identifier names, unlinked TODOs).
3. **`.husky/pre-commit`** — runs lint-staged, banned-names, and typecheck
   before every commit.
4. **`.github/workflows/ci.yml`** — runs lint, banned-names, build,
   typecheck, and test on every push and PR.

## Rule → Enforcement Mapping

| Steering rule | Mechanism | Biome rule / script |
|---|---|---|
| §3.1 No force unwraps (`!`) | Biome | `style/noNonNullAssertion: error` |
| §3.1 No compiler silencing | `check-banned.sh` | grep for `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error` |
| §3.2 Cognitive complexity ≤ 8 | Biome | `complexity/noExcessiveCognitiveComplexity: { maxAllowedComplexity: 8 }` |
| §3.3 Function names: camelCase/PascalCase | Biome | `style/useNamingConvention` |
| §3.3 Type names: PascalCase | Biome | `style/useNamingConvention` |
| §3.3 Enum member names: PascalCase | Biome | `style/useNamingConvention` |
| §3.3 Banned names (`Helper` / `Util` / `Service` / `Handler` / …) | `check-banned.sh` | grep for `class|interface|type <Banned>` |
| §3.3 Banned locals (`tmp1` / `data2` / `obj` / `info`) | `check-banned.sh` | grep for declarations |
| §3.5 Formatting (line length 100, indent 2, LF) | Biome formatter | `formatter.lineWidth: 100`, `indentWidth: 2`, `lineEnding: lf` |
| §4.1 `const` over `let` | Biome | `style/useConst: error` |
| §4.1 Minimal visibility | tsconfig | `strict: true`, team review |
| §4.3 No `any` | Biome | `suspicious/noExplicitAny: error` |
| §4.3 No non-null assertion | Biome | `style/noNonNullAssertion: error` |
| §4.3 `as const` over `enum` for string unions | Biome | `style/useLiteralEnumMembers: error` |
| §4.3 No `Object` / `Function` / `{}` as types | Biome | `complexity/noBannedTypes: error` |
| §5.1 Never assume non-null | tsconfig | `strict: true`, `strictNullChecks: true` |
| §5.2 Strict equality (`===`) | Biome | `suspicious/noDoubleEquals: error` |
| §5.2 Exhaustive switch | tsconfig | `noFallthroughCasesInSwitch: true` |
| §6.1 Every `switch` has `default` | Biome | `style/useDefaultSwitchClause: error` |
| §7 / §9 No unhandled promises | Biome | `suspicious/useAwait: error` |
| §11 No unbounded collection growth | Review (not lintable) |  |
| §13 No required parameters without defaults | Review (not lintable) |  |
| §14 One assertion per test | Review (not lintable) |  |
| §14 No `try/catch + throw new Error("expected throw")` | `check-banned.sh` (if added) / code review | Banned per [`testing-standards.md`](.kiro/steering/testing-standards.md) §5 |
| §14 No `try/catch + expect.fail` in error tests | `check-banned.sh` (if added) / code review | Banned per [`testing-standards.md`](.kiro/steering/testing-standards.md) §5 |
| §14 Every test file has `@module` JSDoc | Review (not lintable) | Convention per [`testing-standards.md`](.kiro/steering/testing-standards.md) §1 |
| §14 No `toBeDefined` as sole assertion on typed non-null | Review (not lintable) | Per [`testing-standards.md`](.kiro/steering/testing-standards.md) §4 |
| §14 No `toContain` on substrings that literally appear in test input | Review (not lintable) | Per [`testing-standards.md`](.kiro/steering/testing-standards.md) §6 |
| §15 No `print` / `console.log` | Biome | `suspicious/noConsole: { allow: ["warn", "error"] }` |
| §2.2 No `// TODO`/`HACK` without linked ticket | `check-banned.sh` | grep for `// TODO` without `#N` or `ABC-N` or URL |
| Other: no `@Suppress` silencing | Biome + grep | `style/noNonNullAssertion`, `check-banned.sh` |
| Other: no default exports (except config / apps) | Biome | `style/noDefaultExport: error` + overrides |
| Other: no barrel files (except public index) | Biome | `performance/noBarrelFile: error` + overrides |
| Other: `import type` for type-only imports | Biome | `style/useImportType: error` |
| Other: `Number.parseInt` not `parseInt` | Biome | `style/useNumberNamespace: error` |

## Performance exceptions

The steering doc permits relaxing rules *only* for documented performance
paths. These overrides are all scoped in `biome.json` and mirror the file
headers that explain the exception in prose:

- **Parser (`packages/parser/src/**`)** — `useForOf`, `noNonNullAssertion`,
  `noParameterAssign`, `useDefaultSwitchClause`, `useNamingConvention`,
  `useNumberNamespace`, `noExcessiveCognitiveComplexity`, `noBannedTypes`,
  `noSwitchDeclarations`, `noBarrelFile` → off. Design doc explicitly
  calls out V8 jump-table and monomorphic-IC requirements.
- **HTML / React / RN renderer hot paths** (see the file list in
  `biome.json` under the second override) — `noNonNullAssertion`,
  `useForOf`, `noExcessiveCognitiveComplexity`,
  `useSimplifiedLogicExpression`, `noDangerouslySetInnerHtml` → off.
  These files do the per-token dispatch work on every streaming chunk;
  for-of and guarded-optional-chains measurably slow them.
- **Test files and `__tests__` stubs** — `noNonNullAssertion`,
  `useNamingConvention`, `noExcessiveCognitiveComplexity`,
  `noExcessiveNestedTestSuites`, `noMisplacedAssertion` → off. Test
  setup code legitimately uses non-null assertions against known-good
  fixtures and nests describe blocks by domain.
- **Scripts / apps / bench / demos** — `noConsole`, `useForOf`,
  `useNumberNamespace`, `noNonNullAssertion`, `noBarrelFile` → off.
  Not shipped to production; output to stdout is the point.
- **Public `src/index.ts` of every package** — `noBarrelFile`,
  `noReExportAll` → off. The whole purpose of these files is to
  re-export the public surface.
- **HTML and CSS files** — whole linter disabled. Biome's web-asset
  linter fires rules (`useNumberNamespace`, `noDescendingSpecificity`)
  that are irrelevant here and conflict with the embedded demo scripts.

## Running locally

```
npm run lint          # biome check (errors fail)
npm run lint:fix      # biome check --write --unsafe
npm run check:banned  # grep script
npm run typecheck     # tsc --noEmit across workspaces
npm run test          # vitest across workspaces
```

`git commit` runs lint-staged + `check:banned` + `typecheck` via the
pre-commit hook. CI runs the same gate plus `build` and `test` on every
push and PR.

## Updating the rules

When adding a steering rule:
1. If Biome has a matching rule, add it under the appropriate category
   in `biome.json`. Prefer `error` level; only use `off` with a scoped
   override.
2. If Biome can't express the rule, extend `scripts/check-banned.sh`.
3. Add a row to the mapping table in this file.
4. Run `npm run lint` and fix any new violations before merging.
