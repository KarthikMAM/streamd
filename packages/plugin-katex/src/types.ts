/**
 * Public option types for `@streamd/plugin-katex`.
 *
 * @module types
 */

/**
 * How the plugin should pick `displayMode` for a given math token.
 *
 * - `"auto"` (default) — `MathBlock` renders in display mode, `MathInline`
 *   renders inline. This matches the common mental model of `$...$` vs
 *   `$$...$$` in markdown.
 * - `"always-block"` — every math token uses display mode regardless of
 *   the token kind. Useful for forcing large typesetting on pages that
 *   only use inline math but want full-display presentation.
 * - `"always-inline"` — every math token uses inline mode. Useful for
 *   very dense technical prose where even block math should fit inline.
 */
export type KatexDisplayMode = "auto" | "always-block" | "always-inline";

/**
 * Options accepted by {@link katex}.
 *
 * Every field is optional — the default configuration renders both
 * block and inline math with KaTeX defaults and produces a safe HTML
 * fallback for syntactically invalid input (a `<span class="katex-error">`
 * containing the raw source).
 */
export interface KatexPluginOptions {
  /**
   * Surface invalid LaTeX as a thrown KaTeX error.
   *
   * When `false` (the default, matching KaTeX's own
   * `ParseError` behaviour), the plugin catches the error and emits
   * a fallback HTML span instead. When `true`, the `plugin.transform`
   * throws, and `applyPlugins` will re-wrap the throw as a
   * `StreamdPluginAbiError` with `kind: "transform-failed"`.
   */
  readonly throwOnError?: boolean;

  /**
   * How to pick `displayMode` per math token. Default: `"auto"` (block
   * tokens display, inline tokens inline). See {@link KatexDisplayMode}
   * for other values.
   */
  readonly displayMode?: KatexDisplayMode;

  /**
   * Custom LaTeX macros. Map of macro name (including leading
   * backslash) to its expansion. Passed straight through to
   * `katex.renderToString`.
   *
   * Example: `{ "\\R": "\\mathbb{R}" }`. See
   * https://katex.org/docs/options.html#macros for the full contract.
   */
  readonly macros?: Readonly<Record<string, string>>;
}
