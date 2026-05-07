/**
 * `katex()` — synchronous factory that returns a {@link Plugin} ready
 * to render every `MathBlock` and `MathInline` token in a streamd
 * token tree through KaTeX.
 *
 * # Why sync
 *
 * KaTeX exposes a synchronous `renderToString` API — there is no
 * grammar / font init to await — so the factory is a plain function
 * that returns a `Plugin`. Consumers don't need to plumb `await`
 * through their render loop.
 *
 * # What the plugin does
 *
 * For every `MathBlock` and `MathInline` token (at any nesting depth,
 * thanks to `walk()` from `@streamd/plugins`), the transform calls
 * `katex.renderToString` on the token's `content` and stores the
 * rendered HTML on `token.meta.html`. Renderers with
 * `allowDangerousMetaHtml: true` splice that HTML verbatim in place
 * of the default math emission.
 *
 * # Security contract
 *
 * KaTeX's output is safe by construction — it escapes all user
 * input and produces only `<span>`, `<mn>`, `<mo>`, and related MathML
 * elements. But the renderer cannot verify that on its own, so the
 * opt-in `allowDangerousMetaHtml: true` flag is required on the
 * renderer for this plugin's output to actually reach the page. See
 * this package's README for the full matrix with `sanitize()`.
 *
 * @module katex
 */

import {
  type MathBlockToken,
  type MathInlineToken,
  TOKEN_SCHEMA_VERSION,
  type TokensList,
  TokenType,
} from "@streamd/parser";
import { type Plugin, walk } from "@streamd/plugins";
import katexLib, { type KatexOptions } from "katex";
import type { KatexDisplayMode, KatexPluginOptions } from "./types";
import { assertKatexOptions } from "./validation";

/**
 * Caller name attached to every argument-error thrown from this
 * module.
 *
 * Matches the public factory function name so stack traces and
 * error messages read naturally (e.g. `"katex: expected options…"`).
 * Stable across versions so diagnostic tooling can key on it
 * without coupling to internal refactors.
 */
const CALLER = "katex";

/**
 * Fully-resolved options used during the transform. Narrower than
 * {@link KatexPluginOptions} — every optional field has been
 * defaulted so the downstream helpers never read `undefined`.
 */
interface ResolvedOptions {
  /** Whether KaTeX should throw on invalid LaTeX (`false` by default). */
  readonly throwOnError: boolean;
  /** Resolved display-mode strategy (defaults to `"auto"`). */
  readonly displayMode: KatexDisplayMode;
  /** Custom LaTeX macros map (defaults to empty `{}`). */
  readonly macros: Readonly<Record<string, string>>;
}

/**
 * Build a configured KaTeX plugin.
 *
 * Validates options (defaulting every unset field), then returns a
 * synchronous `Plugin` whose `transform` walks every `MathBlock`
 * and `MathInline` token and stores KaTeX output on
 * `token.meta.html`.
 *
 * @param options See {@link KatexPluginOptions}. All fields
 *   optional. Omit the argument entirely to accept every default.
 * @returns A {@link Plugin} ready to pass to any streamd renderer.
 * @throws {StreamdPluginKatexArgumentError} When `options` fail the
 *   factory-boundary validation guards in `./validation`.
 *
 * @example
 * ```ts
 * const katexPlugin = katex({
 *   throwOnError: false,
 *   macros: { "\\R": "\\mathbb{R}" },
 * });
 * const html = renderHtml(tokens, {
 *   plugins: [katexPlugin],
 *   allowDangerousMetaHtml: true,
 * });
 * ```
 */
export function katex(options: KatexPluginOptions = {}): Plugin {
  assertKatexOptions(options, CALLER);
  const resolved = resolveOptions(options);
  return {
    name: "katex",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens: TokensList): TokensList {
      return renderMath(tokens, resolved);
    },
  };
}

/**
 * Normalise caller-supplied options into the internal
 * {@link ResolvedOptions} shape by applying every default.
 *
 * @param options Validated plugin options.
 * @returns Resolved options for the transform path.
 */
function resolveOptions(options: KatexPluginOptions): ResolvedOptions {
  return {
    throwOnError: options.throwOnError === true,
    displayMode: options.displayMode ?? "auto",
    macros: options.macros ?? {},
  };
}

/**
 * Walk a token tree and annotate every math token with KaTeX output.
 *
 * @param tokens Token tree. Not mutated.
 * @param opts Resolved options.
 * @returns New token tree; structurally equal to input for tokens
 *   that were not annotated (returned by reference).
 */
function renderMath(tokens: TokensList, opts: ResolvedOptions): TokensList {
  return walk(tokens, {
    block(token) {
      if (token.type !== TokenType.MathBlock) return undefined;
      return annotateBlock(token, opts);
    },
    inline(token) {
      if (token.type !== TokenType.MathInline) return undefined;
      return annotateInline(token, opts);
    },
  });
}

/**
 * Render a `MathBlock` token and attach the result to `meta.html`.
 *
 * @param token Source token. Not mutated.
 * @param opts Resolved options.
 * @returns Possibly-annotated copy; input by reference when
 *   `meta.html` was already set.
 */
function annotateBlock(token: MathBlockToken, opts: ResolvedOptions): MathBlockToken {
  if (token.meta?.html !== undefined) return token;
  const html = renderKatex(token.content, resolveDisplay(opts.displayMode, true), opts);
  return { ...token, meta: { ...(token.meta ?? {}), html } };
}

/**
 * Render a `MathInline` token and attach the result to `meta.html`.
 *
 * @param token Source token. Not mutated.
 * @param opts Resolved options.
 * @returns Possibly-annotated copy; input by reference when
 *   `meta.html` was already set.
 */
function annotateInline(token: MathInlineToken, opts: ResolvedOptions): MathInlineToken {
  if (token.meta?.html !== undefined) return token;
  const html = renderKatex(token.content, resolveDisplay(opts.displayMode, false), opts);
  return { ...token, meta: { ...(token.meta ?? {}), html } };
}

/**
 * Translate the plugin's `displayMode` setting and the token's own
 * block/inline nature into a concrete `displayMode` boolean for
 * KaTeX.
 *
 * @param mode Plugin-level setting (defaults to `"auto"`).
 * @param tokenIsBlock `true` for `MathBlock`, `false` for `MathInline`.
 * @returns `true` to render in KaTeX display mode, `false` otherwise.
 */
function resolveDisplay(mode: KatexDisplayMode, tokenIsBlock: boolean): boolean {
  if (mode === "always-block") return true;
  if (mode === "always-inline") return false;
  return tokenIsBlock;
}

/**
 * Call `katex.renderToString` with the resolved options.
 *
 * `throwOnError` is passed straight through to KaTeX — when `false`
 * (the default), KaTeX catches its own `ParseError` and emits a
 * fallback span with the error message. When `true`, the error
 * bubbles out of `transform`; `applyPlugins` will rewrap it as
 * `StreamdPluginAbiError` with `kind: "transform-failed"` and the
 * original KaTeX error on `cause`.
 *
 * @param content Raw LaTeX source (with delimiters already stripped
 *   by the parser).
 * @param displayMode Whether KaTeX should render in block mode.
 * @param opts Resolved options.
 * @returns KaTeX-rendered HTML string.
 */
function renderKatex(content: string, displayMode: boolean, opts: ResolvedOptions): string {
  const katexOpts: KatexOptions = {
    displayMode,
    throwOnError: opts.throwOnError,
    macros: { ...opts.macros },
  };
  return katexLib.renderToString(content, katexOpts);
}
