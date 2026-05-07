# Changelog

All notable changes to this monorepo are documented here. Per-package
changelogs live under `packages/<name>/CHANGELOG.md` and are generated
by Changesets on every release.

This file captures monorepo-wide milestones that don't map cleanly to a
single package — tooling rollouts, steering-rule changes, CI additions,
and governance docs.

The format is loosely [Keep a Changelog](https://keepachangelog.com/)
with sections keyed on the event type.

## Unreleased

### Breaking
- `Plugin.requires.tokenSchema` is now mandatory on every plugin.
  `applyPlugins` throws `StreamdPluginAbiError` with
  `kind: "missing-requires"` when the declaration is absent and
  `kind: "token-schema-mismatch"` when the declared version does not
  match the parser's `TOKEN_SCHEMA_VERSION`. Existing plugins that
  omitted the field must import `TOKEN_SCHEMA_VERSION` from
  `@streamd/parser` and declare `requires: { tokenSchema: TOKEN_SCHEMA_VERSION }`.
- `sanitize()` must be the final entry in the plugin pipeline.
  `applyPlugins` throws `StreamdPluginAbiError` with
  `kind: "sanitize-not-last"` when any plugin appears after
  `sanitize()`. Reorder existing pipelines so that `sanitize()` is the
  last entry.
- Plugin-attached `token.meta.html` is no longer rendered by default.
  The HTML, React, and React Native renderers now ignore `meta.html`
  unless `allowDangerousMetaHtml: true` is passed explicitly. Callers
  relying on `@streamd/plugins`' `highlightCode`,
  `@streamd/plugin-shiki`, or `@streamd/plugin-katex` must opt in via
  the renderer option or the CLI `--allow-dangerous-meta-html` flag.

### Added
- `@streamd/plugin-shiki` — Shiki syntax-highlighter adapter. Async
  factory, bundled grammar and theme loading, per-block language
  detection with configurable `onUnknownLang` behaviour, dual-theme
  output via Shiki's light/dark split.
- `@streamd/plugin-katex` — KaTeX math-renderer adapter. Synchronous
  factory, inline / display / auto modes, macros pass-through,
  `throwOnError` plumbed through to KaTeX.
- `@streamd/cli` — `streamd` CLI. `--stream {auto|delta|full|off}`
  streaming modes, `--theme {light|dark|none}` inline theme CSS,
  `--gfm`, `--math`, `--anchors`, `--link-attrs`,
  `--sanitize` / `--no-sanitize`, `--allow-dangerous-meta-html`,
  `--class-prefix`, `--wrap-root`, `--xhtml` / `--no-xhtml`, typed exit
  codes, and a programmatic `run()` API for tests and downstream
  tools.
- `useStreamingMarkdown` hook on `@streamd/react-native` — same
  signature as the `@streamd/react` hook (`(initialSource, parseOptions)`
  → `{ tokens, stableCount, append, reset }`). Pairs with
  `<StreamdMarkdownNative>` the same way the React hook pairs with
  `<StreamdMarkdown>`.
- React 18 concurrency support — the `react` peer dependency on
  `@streamd/react` and `@streamd/react-native` now accepts both
  `^18.0.0` and `^19.0.0`.
- Accessibility attributes emitted by every renderer:
  - HTML renderer: `role="checkbox"`, `aria-checked`, and
    `aria-disabled` on task-list items; `role="region"` and
    `aria-label="<lang> code block"` on fenced code blocks with a
    declared language.
  - React renderer: matching ARIA attributes on the default
    components, covered by `packages/react/src/a11y.test.tsx`.
  - React Native renderer: `accessibilityRole="header"` and
    `accessibilityLabel` on headings, `accessibilityRole="checkbox"`
    and `accessibilityState={{ checked, disabled: true }}` on task
    items, covered by `packages/react-native/src/a11y.test.tsx`.
- Governance docs (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`).
- ADR process under `docs/adr/` with three initial entries (parser perf
  exceptions, streaming contract, performance baseline governance).
- RFC template under `docs/rfcs/` for breaking-change proposals.
- Cross-package error hierarchy rooted at `StreamdArgumentError` in
  `@streamd/tokens`.
- Plugin ABI version check (`TOKEN_SCHEMA_VERSION` + `Plugin.requires`).
- Streaming-equivalence fuzzer in `@streamd/e2e` (`src/fuzzer/`) —
  generates randomised markdown + chunking schedules and asserts
  identical token output and renderer output across one-shot and
  streaming paths.
- Streaming invariant test suite
  (`packages/e2e/streaming-invariants.test.ts`).
- Renderer equivalence contract tests
  (`packages/e2e/renderer-equivalence.test.ts`).
- Public-API consumer tests + type-level tests.
- Per-skip classification in `@streamd/spec` —
  `SkipClassification` (`documented-limitation` | `fixable` |
  `known-bug` | `under-investigation`) with optional
  `docLinkInParserDesign` and `trackingUrl` per cluster, rendered into
  the spec regression guard's output.
- Performance baseline (`packages/bench/baseline.json`) with
  median-of-3 capture and per-record `heapUsedBytes`. Regression gate
  at ±15% throughput threshold. Wired into CI as a warn-only job.
- CI jobs: publish-readiness (publint + attw), bundle size budgets,
  spec conformance regression guard, license compat scan, dead-code
  scan, circular-dependency scan, package metadata consistency check,
  relative markdown link checker, perf regression gate.

### Changed
- Input validation on every renderer now throws a typed
  `Streamd*ArgumentError`. `@streamd/html` throws
  `StreamdHtmlArgumentError`, `@streamd/react` throws
  `StreamdReactArgumentError`, `@streamd/react-native` throws
  `StreamdReactNativeArgumentError`, `@streamd/plugins` throws
  `StreamdPluginAbiError`, `@streamd/plugin-shiki` /
  `@streamd/plugin-katex` / `@streamd/cli` throw their package-specific
  errors. All extend `StreamdArgumentError` from `@streamd/tokens`, so
  a single `catch (err instanceof StreamdArgumentError)` covers every
  streamd input-validation failure.
- Spec regression guard now checks pass/fail identity per fixture,
  not just the overall pass count. A run fails if any previously
  passing fixture starts failing, or any previously failing fixture
  starts passing without an accompanying `SKIP_METADATA` update.
- Published-package `exports` fixed: `import.types` now points at
  `./dist/index.d.mts` (was an incorrect `./dist/index.d.ts`).
- `engines.node` normalized to `>=22` across root and all published
  packages, matching `.nvmrc`.
- 0.x dependency pins tightened from `^0.x` to `~0.x`.

### Fixed
- `meta.html` / `meta.attrs` XSS surfaces closed off by default.
  `sanitize()` strips `token.meta.html` unless `allowRawHtml: true` is
  set explicitly and filters `token.meta.attrs` through
  `isSafeAttributeName`. The HTML / React / React Native renderers
  ignore `meta.html` unless the caller opts in via
  `allowDangerousMetaHtml`. Before this change a misbehaving
  highlight plugin could smuggle raw HTML past the sanitizer via
  `meta.html`.
- `StreamdPluginAbiError` (`kind: "transform-failed"`) now wraps
  thrown plugin errors with the plugin name on `pluginName` and the
  original error on `cause`, instead of surfacing as an unstructured
  `Error`.

### Removed
- Dead exports: `printTable` (bench/runner.ts), `_CC_LOW_SURROGATE_START`
  (html/escape.ts), `resetAttrCache` (html/render.ts).
- Dead devDependencies: `react-test-renderer`, `@types/react-test-renderer`,
  `@streamd/tokens` (from bench), `@streamd/parser` (from demo apps),
  `@streamd/react-native` (from bench).

---

Releases will append dated sections below this line via Changesets.
