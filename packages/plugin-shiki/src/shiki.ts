/**
 * `shiki()` — async factory that resolves a {@link Plugin} ready to
 * syntax-highlight every `CodeBlock` token in a streamd token tree.
 *
 * # Why async
 *
 * Shiki v1 is async-only: `createHighlighter` loads TextMate grammars
 * and themes through a WASM engine. We await that init once in the
 * factory and hand back a synchronous `Plugin.transform` — matching
 * the `@streamd/plugins` contract without forcing every consumer to
 * plumb `await` into their render loop.
 *
 * # What the plugin does
 *
 * For every `CodeBlock` token (at any nesting depth — the
 * `walk()` helper from `@streamd/plugins` descends into blockquotes
 * and list items), the transform calls `highlighter.codeToHtml` and
 * stores the result on `token.meta.html`. Renderers with
 * `allowDangerousMetaHtml: true` splice that HTML verbatim in place
 * of the default `<pre><code>` output.
 *
 * # Security contract
 *
 * The pre-rendered HTML lives in `token.meta.html`. Two things must
 * hold for that HTML to actually reach the page:
 *
 * 1. The caller must set `allowDangerousMetaHtml: true` on the
 *    renderer (or not use `sanitize()` in the pipeline). Shiki's
 *    output is safe by construction — Shiki escapes every code token
 *    and only emits `<pre>`, `<code>`, and `<span>` elements — but
 *    the renderer cannot know that, so the opt-in is required.
 *
 * 2. If `sanitize()` is part of the pipeline, it must be configured
 *    with `{ allowRawHtml: true }` or it will strip `meta.html` as
 *    defense-in-depth against plugins that emit unsafe HTML.
 *
 * @module shiki
 */

import {
  type CodeBlockToken,
  TOKEN_SCHEMA_VERSION,
  type Token,
  type TokensList,
  TokenType,
} from "@streamd/parser";
import { type Plugin, walk } from "@streamd/plugins";
import { createHighlighter, type Highlighter, type ThemeRegistrationAny } from "shiki";
import { shikiErrorMessage } from "./messages";
import type { ShikiPluginOptions, ShikiUnknownLangBehavior } from "./types";
import { assertShikiOptions, StreamdPluginShikiArgumentError } from "./validation";

/**
 * Caller name attached to every argument-error thrown from this
 * module. Stable across versions so diagnostic tooling can key on it.
 */
const CALLER = "shiki";

/**
 * Shiki language used as the "plaintext" fallback. Matches Shiki's
 * own bundled language identifier.
 */
const PLAINTEXT_LANG = "plaintext";

/**
 * Default language set used when {@link ShikiPluginOptions.langs} is
 * omitted. Covers the mix that LLM-streamed markdown typically emits
 * while keeping the highlighter init cost bounded.
 *
 * Consumers that know their corpus (e.g. docs for a specific
 * language) should pin `langs` for faster startup and smaller
 * highlighter state.
 */
const DEFAULT_LANGS: ReadonlyArray<string> = [
  "plaintext",
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "html",
  "css",
  "json",
  "yaml",
  "markdown",
  "bash",
  "python",
];

/**
 * Module-level cache of in-flight / resolved highlighter instances,
 * keyed by the stable serialisation of `(themes, langs)`. Reused
 * across every {@link shiki} call with `cache: true` (the default).
 *
 * Stores the `Promise<Highlighter>` directly so concurrent callers
 * with the same configuration share the single init in flight rather
 * than racing to build duplicates.
 */
const HIGHLIGHTER_CACHE = new Map<string, Promise<Highlighter>>();

/**
 * Resolved options passed around the transform helpers. Narrower
 * than {@link ShikiPluginOptions} — every optional field has been
 * defaulted so downstream code never reads `undefined`.
 */
interface ResolvedOptions {
  /** Light/dark theme pair passed to Shiki's `codeToHtml`. */
  readonly themes: { readonly light: string; readonly dark: string };
  /** Behaviour when a code block's language is not loaded. */
  readonly onUnknownLang: ShikiUnknownLangBehavior;
}

/**
 * Build a configured Shiki plugin.
 *
 * Validates options, eagerly resolves the Shiki highlighter (awaiting
 * grammar + theme init), then returns a synchronous `Plugin` whose
 * `transform` annotates every `CodeBlock` token's `meta.html` with
 * the highlighter output.
 *
 * @param options See {@link ShikiPluginOptions}. `themes` is required.
 * @returns Promise resolving to a {@link Plugin}. `await` the promise
 *   once at application startup, then pass the resolved plugin into
 *   every renderer that should use it.
 * @throws {StreamdPluginShikiArgumentError} When `options` fail the
 *   factory-boundary validation guards in `./validation`.
 *
 * @example
 * ```ts
 * const shikiPlugin = await shiki({
 *   themes: { light: "github-light", dark: "github-dark" },
 *   langs: ["typescript", "bash"],
 * });
 * const html = renderHtml(tokens, {
 *   plugins: [shikiPlugin],
 *   allowDangerousMetaHtml: true,
 * });
 * ```
 */
export async function shiki(options: ShikiPluginOptions): Promise<Plugin> {
  assertShikiOptions(options, CALLER);

  const highlighter = await resolveHighlighter(options);
  const resolved = resolveOptions(options);

  return {
    name: "shiki",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens: TokensList): TokensList {
      return highlightTokens(tokens, highlighter, resolved);
    },
  };
}

/**
 * Either return the cached highlighter for the given config or
 * create a fresh one.
 *
 * The cache respects `options.cache`: when `false`, a new highlighter
 * is built on every call. When `true` (the default), the first call
 * for a given `(themes, langs)` key populates the cache and every
 * later call with a matching key resolves to the same highlighter.
 *
 * @param options Validated plugin options.
 * @returns Promise resolving to a ready-to-use highlighter.
 */
function resolveHighlighter(options: ShikiPluginOptions): Promise<Highlighter> {
  if (options.cache === false) return buildHighlighter(options);

  const key = highlighterCacheKey(options);
  const existing = HIGHLIGHTER_CACHE.get(key);

  if (existing !== undefined) return existing;

  const pending = buildHighlighter(options);
  HIGHLIGHTER_CACHE.set(key, pending);

  return pending;
}

/**
 * Compute a stable cache key from the themes + langs.
 *
 * `loadTheme` and `onUnknownLang` are deliberately excluded — the
 * former influences only init, the latter only the transform, so
 * neither affects the resulting highlighter's bytecode.
 *
 * @param options Validated plugin options.
 * @returns JSON string usable as a `Map` key.
 */
function highlighterCacheKey(options: ShikiPluginOptions): string {
  const langs = options.langs ? [...options.langs].sort() : DEFAULT_LANGS;

  return JSON.stringify({
    light: options.themes.light,
    dark: options.themes.dark,
    langs,
  });
}

/**
 * Build a fresh Shiki highlighter for the given options.
 *
 * Resolves the themes through {@link ShikiPluginOptions.loadTheme}
 * when supplied; otherwise passes theme names straight through for
 * Shiki's bundled-theme resolution.
 *
 * @param options Validated plugin options.
 * @returns Promise resolving to a ready-to-use highlighter.
 */
async function buildHighlighter(options: ShikiPluginOptions): Promise<Highlighter> {
  const themes = await resolveThemes(options);
  const langs = options.langs ? Array.from(options.langs) : Array.from(DEFAULT_LANGS);

  return createHighlighter({ themes, langs });
}

/**
 * Resolve the two theme entries into the shape Shiki's
 * `createHighlighter` accepts.
 *
 * When {@link ShikiPluginOptions.loadTheme} is supplied, the
 * callback is invoked for both `light` and `dark`. Otherwise the raw
 * theme-name strings are passed through for bundled-theme lookup.
 *
 * @param options Validated plugin options.
 * @returns Two-entry array suitable for `createHighlighter({ themes })`.
 */
async function resolveThemes(
  options: ShikiPluginOptions,
): Promise<Array<string | ThemeRegistrationAny>> {
  if (!options.loadTheme) return [options.themes.light, options.themes.dark];

  const [light, dark] = await Promise.all([
    options.loadTheme(options.themes.light),
    options.loadTheme(options.themes.dark),
  ]);

  return [light as ThemeRegistrationAny, dark as ThemeRegistrationAny];
}

/**
 * Normalise caller-supplied options into the internal
 * {@link ResolvedOptions} shape by applying every default.
 *
 * @param options Validated plugin options.
 * @returns Resolved options for the transform path.
 */
function resolveOptions(options: ShikiPluginOptions): ResolvedOptions {
  return {
    themes: { light: options.themes.light, dark: options.themes.dark },
    onUnknownLang: options.onUnknownLang ?? "plaintext",
  };
}

/**
 * Walk a full token tree and annotate every `CodeBlock` leaf with the
 * highlighter's HTML. Uses {@link walk} so nested code blocks (inside
 * blockquotes, list items, etc.) are covered.
 *
 * @param tokens Token tree. Not mutated.
 * @param highlighter Ready Shiki highlighter.
 * @param opts Resolved options.
 * @returns New token tree; structurally equal to input for tokens
 *   that were not annotated (returned by reference).
 */
function highlightTokens(
  tokens: TokensList,
  highlighter: Highlighter,
  opts: ResolvedOptions,
): TokensList {
  return walk(tokens, {
    block(token) {
      if (token.type !== TokenType.CodeBlock) return undefined;

      return annotateCodeBlock(token, highlighter, opts);
    },
  });
}

/**
 * If the code block qualifies, return a shallow copy with
 * `meta.html` populated. Otherwise return the token unchanged.
 *
 * A block qualifies when:
 * - `meta.html` is not already set (previous highlighter wins)
 * - the language resolution (per {@link ResolvedOptions.onUnknownLang})
 *   produces a non-null language string
 *
 * @param token Input code-block token.
 * @param highlighter Ready Shiki highlighter.
 * @param opts Resolved options.
 * @returns Possibly-annotated token.
 */
function annotateCodeBlock(
  token: CodeBlockToken,
  highlighter: Highlighter,
  opts: ResolvedOptions,
): Token {
  if (token.meta?.html !== undefined) return token;

  const lang = resolveLanguage(token.lang, highlighter, opts);

  if (lang === null) return token;

  const html = highlighter.codeToHtml(token.content, { lang, themes: opts.themes });

  return { ...token, meta: { ...(token.meta ?? {}), html } };
}

/**
 * Decide which language to feed Shiki for a given code-block token.
 *
 * Handles three cases:
 * - Empty `lang` — use the unknown-language behaviour (which also
 *   covers plaintext and ignore).
 * - Loaded language — pass it straight through.
 * - Unknown language (present but not loaded) — also dispatch to the
 *   unknown-language behaviour.
 *
 * @param lang Raw `CodeBlockToken.lang` field.
 * @param highlighter Ready Shiki highlighter.
 * @param opts Resolved options.
 * @returns Shiki language name, or `null` when the token should be
 *   left untouched (`onUnknownLang: "ignore"`).
 * @throws {StreamdPluginShikiArgumentError} With
 *   `kind: "unknown-language"` when `onUnknownLang === "error"`.
 */
function resolveLanguage(
  lang: string,
  highlighter: Highlighter,
  opts: ResolvedOptions,
): string | null {
  if (lang.length === 0) return handleUnknown(lang, opts);

  const loaded = highlighter.getLoadedLanguages();
  const isLoaded = loaded.includes(lang);

  if (isLoaded) return lang;

  return handleUnknown(lang, opts);
}

/**
 * Apply {@link ResolvedOptions.onUnknownLang} when the raw language
 * is missing or not loaded.
 *
 * @param lang Offending language string (may be empty).
 * @param opts Resolved options.
 * @returns Replacement language, or `null` to skip the token.
 * @throws {StreamdPluginShikiArgumentError} On `"error"` mode.
 */
function handleUnknown(lang: string, opts: ResolvedOptions): string | null {
  if (opts.onUnknownLang === "ignore") return null;
  if (opts.onUnknownLang === "plaintext") return PLAINTEXT_LANG;

  throw new StreamdPluginShikiArgumentError({
    kind: "unknown-language",
    caller: CALLER,
    message: shikiErrorMessage.unknownLanguage(lang),
  });
}
