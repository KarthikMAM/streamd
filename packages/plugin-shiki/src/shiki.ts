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
 * and list items), the transform calls `highlighter.codeToTokens` and
 * stores the structured result on `token.meta.highlight`. Renderers
 * read `meta.highlight` and emit styled spans / Text trees directly.
 *
 * @module shiki
 */

import {
  type CodeBlockToken,
  type HighlightData,
  type ThemedSegment,
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

/** FontStyle bitmask values from Shiki's vscode-textmate. */
const FONT_STYLE_ITALIC = 1;
const FONT_STYLE_BOLD = 2;
const FONT_STYLE_UNDERLINE = 4;

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
 * keyed by the stable serialisation of `(themes, langs)`.
 */
const HIGHLIGHTER_CACHE = new Map<string, Promise<Highlighter>>();

/**
 * Resolved options passed around the transform helpers. Every
 * optional field has been defaulted.
 */
interface ResolvedOptions {
  /** Light/dark theme pair passed to Shiki's `codeToTokens`. */
  readonly themes: { readonly light: string; readonly dark: string };
  /** Behaviour when a code block's language is not loaded. */
  readonly onUnknownLang: ShikiUnknownLangBehavior;
}

/**
 * Build a configured Shiki plugin.
 *
 * Validates options, eagerly resolves the Shiki highlighter (awaiting
 * grammar + theme init), then returns a synchronous `Plugin` whose
 * `transform` annotates every `CodeBlock` token's `meta.highlight`
 * with structured `HighlightData`.
 *
 * @param options See {@link ShikiPluginOptions}. `themes` is required.
 * @returns Promise resolving to a {@link Plugin}.
 * @throws {StreamdPluginShikiArgumentError} When `options` fail
 *   validation guards.
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
 * Return the cached highlighter or create a fresh one.
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
 * Compute a stable cache key from themes + langs.
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
 * @param options Validated plugin options.
 * @returns Promise resolving to a ready-to-use highlighter.
 */
async function buildHighlighter(options: ShikiPluginOptions): Promise<Highlighter> {
  const themes = await resolveThemes(options);
  const langs = options.langs ? Array.from(options.langs) : Array.from(DEFAULT_LANGS);

  return createHighlighter({ themes, langs });
}

/**
 * Resolve theme entries into the shape Shiki accepts.
 *
 * @param options Validated plugin options.
 * @returns Array suitable for `createHighlighter({ themes })`.
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
 * Normalise options into the internal resolved shape.
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
 * Walk a full token tree and annotate every `CodeBlock` with
 * structured highlight data.
 *
 * @param tokens Token tree. Not mutated.
 * @param highlighter Ready Shiki highlighter.
 * @param opts Resolved options.
 * @returns New token tree with annotated code blocks.
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
 * Annotate a code block with structured `HighlightData` on
 * `meta.highlight`. Skips blocks that already have highlight data.
 *
 * @param token Input code-block token.
 * @param highlighter Ready Shiki highlighter.
 * @param opts Resolved options.
 * @returns Annotated token, or the original if skipped.
 */
function annotateCodeBlock(
  token: CodeBlockToken,
  highlighter: Highlighter,
  opts: ResolvedOptions,
): Token {
  if (token.meta?.highlight !== undefined) return token;

  const lang = resolveLanguage(token.lang, highlighter, opts);

  if (lang === null) return token;

  const result = highlighter.codeToTokens(token.content, {
    lang,
    theme: opts.themes.light,
  } as Parameters<Highlighter["codeToTokens"]>[1]);

  const highlight = buildHighlightData(result.tokens, lang, opts.themes.light);

  return { ...token, meta: { ...(token.meta ?? {}), highlight } };
}

/**
 * Convert Shiki's `ThemedToken[][]` into streamd's `HighlightData`.
 *
 * @param shikiTokens 2D array of themed tokens from Shiki.
 * @param lang Effective language used for highlighting.
 * @param theme Theme key used for highlighting.
 * @returns Structured highlight data for the token meta.
 */
function buildHighlightData(
  shikiTokens: ReadonlyArray<
    ReadonlyArray<{ content: string; color?: string; fontStyle?: number }>
  >,
  lang: string,
  theme: string,
): HighlightData {
  const lines: Array<Array<ThemedSegment>> = [];

  for (const line of shikiTokens) {
    const segments: Array<ThemedSegment> = [];

    for (const token of line) {
      segments.push(mapToken(token));
    }

    lines.push(segments);
  }

  return { lines, lang, theme };
}

/**
 * Map a single Shiki themed token to a streamd `ThemedSegment`.
 *
 * @param token Shiki themed token with content, color, fontStyle.
 * @returns Streamd themed segment.
 */
function mapToken(token: { content: string; color?: string; fontStyle?: number }): ThemedSegment {
  const style = token.fontStyle ?? 0;
  const segment: ThemedSegment = { text: token.content };

  if (token.color) (segment as { color: string }).color = token.color;
  if ((style & FONT_STYLE_BOLD) !== 0) (segment as { bold: boolean }).bold = true;
  if ((style & FONT_STYLE_ITALIC) !== 0) (segment as { italic: boolean }).italic = true;
  if ((style & FONT_STYLE_UNDERLINE) !== 0) (segment as { underline: boolean }).underline = true;

  return segment;
}

/**
 * Decide which language to feed Shiki for a given code-block token.
 *
 * @param lang Raw `CodeBlockToken.lang` field.
 * @param highlighter Ready Shiki highlighter.
 * @param opts Resolved options.
 * @returns Shiki language name, or `null` to skip.
 * @throws {StreamdPluginShikiArgumentError} On `onUnknownLang: "error"`.
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
 * Apply the unknown-language behaviour.
 *
 * @param lang Offending language string (may be empty).
 * @param opts Resolved options.
 * @returns Replacement language, or `null` to skip.
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
