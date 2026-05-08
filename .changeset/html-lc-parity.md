---
"@streamd/html": minor
---

## Breaking changes

- **`allowDangerousMetaHtml` removed.** Passing this option now throws
  `StreamdHtmlArgumentError` with `kind: "deprecated-option"`. HTML is
  never spliced by streamd; supply a `components.code_block` or
  `components.math_block` override if you need pre-rendered HTML.

- **`HtmlBlock` / `HtmlInline` / `Softbreak` handling deleted.** These
  token types no longer exist in parser schema 2.

- **Render dispatch uses string literals.** Token type comparisons are
  now string-based (`"paragraph"`, `"heading"`, etc.) matching the
  parser's `TokenTypeValue` union.

## New features

- **`components` override prop.** Pass `components: { code_block: fn }`
  to replace the default renderer for any token type. Each override
  receives the typed token and an `HtmlRenderContext` with `escapeHtml`,
  `escapeAttr`, `classPrefix`, and a recursive `render` callback.

- **`meta.highlight` rendering.** When a `code_block` token carries
  `meta.highlight` (populated by `@streamd/plugin-shiki`), the default
  renderer emits per-segment `<span>` elements with inline styles
  (`color`, `font-weight`, `font-style`, `text-decoration`).

- **Default math rendering.** `math_block` renders as
  `<pre class="streamd-math-block"><code>…</code></pre>` and
  `math_inline` as `<code class="streamd-math-inline">…</code>`.
  Override via `components.math_block` / `components.math_inline` for
  KaTeX integration.
