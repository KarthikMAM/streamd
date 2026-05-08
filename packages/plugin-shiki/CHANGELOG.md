# @streamd/plugin-shiki

## 0.1.0

### Minor Changes

- 34ddb70: Initial release of two adapter plugins that attach pre-rendered HTML
  to `token.meta.html` for renderers with `allowDangerousMetaHtml: true`:

  - **`@streamd/plugin-shiki`** — async factory that awaits Shiki's
    grammar + theme init once and returns a synchronous `Plugin`.
    Walks every `CodeBlock` (at any nesting depth, via `walk()` from
    `@streamd/plugins`) and stores Shiki's dual-theme HTML on
    `meta.html`. Options cover `themes` (required), `langs`,
    `loadTheme` escape hatch, `onUnknownLang: "ignore" | "error" |
"plaintext"`, and a module-level highlighter cache that can be
    disabled with `cache: false`.

  - **`@streamd/plugin-katex`** — synchronous factory that calls
    `katex.renderToString` for every `MathBlock` and `MathInline`
    token. Options cover `throwOnError`, `displayMode: "auto" |
"always-block" | "always-inline"`, and `macros`. When
    `throwOnError: false` (the default), KaTeX emits its native
    fallback span for invalid LaTeX. When `true`, the throw bubbles
    out of `transform` and `applyPlugins` rewraps it as
    `StreamdPluginAbiError` with `kind: "transform-failed"`.

  ## Security contract

  Both plugins write into `token.meta.html`, which renderers ignore
  unless `allowDangerousMetaHtml: true` is set on the renderer. That
  flag trusts every plugin in the pipeline to produce safe HTML, so
  add it only when you control every plugin you've configured. When
  paired with `sanitize()`, use `sanitize({ allowRawHtml: true })` to
  keep the adapter output — otherwise `sanitize()` strips `meta.html`
  as defence-in-depth and the renderer falls back to its default
  emission.

  ## Error handling

  Both packages export a validation error subclass that extends the
  shared `StreamdArgumentError` from `@streamd/tokens`:

  - `StreamdPluginShikiArgumentError` — kinds cover every
    factory-boundary rejection (`missing-options`,
    `options-not-object`, `themes-missing`, `themes-not-object`,
    `theme-not-string`, `langs-not-array`, `load-theme-not-function`,
    `on-unknown-lang-invalid`) plus the transform-time
    `unknown-language` kind raised when `onUnknownLang: "error"`
    fires.
  - `StreamdPluginKatexArgumentError` — kinds cover
    `options-not-object`, `throw-on-error-not-boolean`,
    `display-mode-invalid`, `macros-not-object`, and
    `macro-value-not-string`.

  Both plugins declare the current `TOKEN_SCHEMA_VERSION` in their
  `requires` field so they're compatible with the H5 plugin-ABI
  hardening that just landed in `@streamd/plugins`.

### Patch Changes

- Updated dependencies [34ddb70]
  - @streamd/plugins@0.1.0
