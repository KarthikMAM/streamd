/**
 * Public option types for `@streamd/plugin-shiki`.
 *
 * @module types
 */

/**
 * How the plugin should behave when it encounters a code block whose
 * language is not in the configured `langs` array (or not bundled by
 * Shiki when `langs` is omitted).
 *
 * - `"plaintext"` (default) — highlight with Shiki's `plaintext` grammar
 *   so the block still gets structured highlight data.
 * - `"ignore"` — leave the token unchanged. The renderer falls back to
 *   its default code-block rendering.
 * - `"error"` — throw `StreamdPluginShikiArgumentError` with
 *   `kind: "unknown-language"`. Useful for CI that wants to surface
 *   fenced blocks with typo'd languages.
 */
export type ShikiUnknownLangBehavior = "ignore" | "error" | "plaintext";

/**
 * Options accepted by {@link shiki}.
 *
 * The only required field is `themes`. Every other field has a
 * sensible default documented inline.
 */
export interface ShikiPluginOptions {
  /**
   * Dual-theme configuration.
   *
   * Values are Shiki bundled theme names (e.g. `"github-light"`,
   * `"github-dark"`, `"material-theme-palenight"`). Custom themes can
   * be loaded via {@link ShikiPluginOptions.loadTheme}.
   *
   * The plugin uses the `light` theme for token colouring. The `dark`
   * theme is registered with the highlighter for consumers that need
   * both sets via a separate call.
   */
  readonly themes: {
    readonly light: string;
    readonly dark: string;
  };

  /**
   * Restrict the grammar set Shiki loads. Defaults to Shiki's bundled
   * language list when omitted — that's ~200 grammars and ~1.5 MB of
   * JSON, so callers that know their content should pin a smaller set
   * for faster factory init and smaller Shiki state.
   */
  readonly langs?: ReadonlyArray<string>;

  /**
   * Escape hatch for consumers that ship custom TextMate grammars or
   * themes not bundled with Shiki. The function receives the theme
   * name and must resolve to the theme JSON shape Shiki accepts.
   *
   * When provided, the plugin passes this callback to Shiki's
   * `loadTheme` option so both entries in {@link ShikiPluginOptions.themes}
   * route through it. Omit to use only Shiki's bundled themes.
   */
  readonly loadTheme?: (name: string) => Promise<unknown>;

  /**
   * How to handle fenced blocks with an unknown language. Default:
   * `"plaintext"`. See {@link ShikiUnknownLangBehavior} for values.
   */
  readonly onUnknownLang?: ShikiUnknownLangBehavior;

  /**
   * When `true` (default), a module-level cache of highlighter
   * instances is reused across calls to {@link shiki} that share an
   * equivalent `themes` + `langs` configuration. When `false`, every
   * factory invocation builds a fresh highlighter.
   *
   * The cache key is stable — two calls with the same themes and the
   * same (sorted) `langs` list resolve to the same highlighter
   * instance. `loadTheme` and `onUnknownLang` do not affect caching
   * since they are consumed only during factory-side init, not
   * during transform.
   */
  readonly cache?: boolean;
}
