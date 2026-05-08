# Changelog

All notable changes to this monorepo are documented here. Per-package
changelogs live under `packages/<name>/CHANGELOG.md` and are generated
by Changesets on every release.

This file captures monorepo-wide milestones that don't map cleanly to a
single package — tooling rollouts, steering-rule changes, CI additions,
and governance docs.

The format is loosely [Keep a Changelog](https://keepachangelog.com/)
with sections keyed on the event type.

## Unreleased — LC-Parity Refactor (0.x breaking bump)

Comprehensive refactor adopting four ideas from LeverageCommons:
string-discriminated tokens, component-owned rendering, streaming
reveal, and parser polish. See
[ADR 0004](docs/adr/0004-lc-parity-refactor.md) for the full design.

### Breaking

- **Token schema 2**: `TOKEN_SCHEMA_VERSION` bumps from 1 to 2.
  Token `.type` fields are now string literals (`"paragraph"`,
  `"code_block"`, etc.) instead of integers. Plugins targeting
  schema 1 throw `StreamdPluginAbiError`.
- **Removed tokens**: `HtmlBlock`, `HtmlInline`, `Softbreak` are
  gone. Source HTML blocks are dropped; inline HTML becomes literal
  text; paragraph newlines collapse into `TextToken.content`.
- **Removed `CodeBlock.info`**: use `token.lang` instead.
- **Removed `allowDangerousMetaHtml`**: the prop, CLI flag, and
  `sanitize-not-last` ABI error kind are all deleted. No `meta.html`
  field exists.
- **Removed `@streamd/plugin-katex`**: KaTeX is now a component
  override — pass a custom `math_block` / `math_inline` component.
- **Component override keys**: all three renderers use snake_case
  keys matching token `.type` discriminants (`code_block`,
  `math_block`, `list_item`, `code_span`, `math_inline`).

### Added

- **Streaming reveal layer** (`@streamd/react/streaming`,
  `@streamd/react-native/streaming`): `StreamingRevealProvider`,
  `Words`, `useShouldStream`. Sixteen animation presets. Word-level
  granularity with smoothed text mode.
- **`MemoBlock`** in `@streamd/react`: memoises block tokens by
  reference identity for zero-cost re-renders of stable content.
- **`shouldEmitSpace(prev, next)`**: parser-level rule set governing
  `SpaceToken` emission between blocks.
- **List-merge streaming fix**: adjacent list tokens arriving in
  separate chunks are merged into a single `ListToken`.
- **Structured `meta.highlight`**: `plugin-shiki` now attaches
  `HighlightData` (typed `ThemedSegment[][]`) instead of raw HTML.
  Default `code_block` components render styled spans directly.

### Changed

- `sanitize()` simplified: URL-scheme allowlist + safe-attrs filter
  only. No longer required to be last in the pipeline.
- `@streamd/cli`: `--allow-dangerous-meta-html` flag removed.

### Performance

- Streaming throughput +50–77% from the incremental list-merge fix
  (eliminates redundant full-document rescans when list items arrive
  across chunk boundaries).

### Affected packages

| Package | Bump |
|---|---|
| `@streamd/parser` | 0.0.1 → 0.1.0 |
| `@streamd/tokens` | 0.0.1 → 0.1.0 |
| `@streamd/plugins` | 0.0.1 → 0.1.0 |
| `@streamd/plugin-shiki` | 0.0.1 → 0.1.0 |
| `@streamd/html` | 0.0.1 → 0.1.0 |
| `@streamd/react` | 0.0.1 → 0.1.0 |
| `@streamd/react-native` | 0.1.0 → 0.2.0 |
| `@streamd/cli` | 0.0.1 → 0.1.0 |
| `@streamd/plugin-katex` | **deleted** |

---

Releases will append dated sections below this line via Changesets.
