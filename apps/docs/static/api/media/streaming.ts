/**
 * Streaming convenience helpers and theme stylesheet generator.
 *
 * @module streaming
 */

import { type ParseOptions, type ParserState, parse } from "@streamd/parser";
import { type Theme, themeToCss } from "@streamd/tokens";
import { renderHtml } from "./render";
import type { RenderHtmlOptions } from "./types";
import { assertString } from "./validation";

/** Result of `streamHtml` — parallels `ParseResult` but for HTML output. */
export interface StreamHtmlResult {
  /** Rendered HTML for the full current source. */
  readonly html: string;
  /** State to pass back on the next call. */
  readonly state: ParserState;
}

/** Options combining parse + render options into one call. */
export interface StreamHtmlOptions extends RenderHtmlOptions {
  /** Parser options (gfm, math, tables, etc.). */
  readonly parse?: ParseOptions;
}

/**
 * Parse the accumulated source and render it to HTML in a single call.
 * Intended for the streaming LLM case where the caller incrementally
 * appends to `src` and wants HTML on each call.
 *
 * @param src - Full accumulated markdown source so far. Must be a string.
 * @param state - Previous `state` from this function, or null for the first call.
 * @param options - Parse + render options.
 * @throws StreamdHtmlArgumentError when `src` is not a string.
 */
export function streamHtml(
  src: string,
  state: ParserState | null,
  options: StreamHtmlOptions = {},
): StreamHtmlResult {
  assertString(src, "streamHtml");
  const parsed = parse(src, state, options.parse);
  const html = renderHtml(parsed.tokens, options);
  return { html, state: parsed.state };
}

/** Options for `renderThemeStylesheet`. */
export interface ThemeStylesheetOptions {
  /** CSS class prefix that was passed to `renderHtml`. Default: "streamd". */
  readonly classPrefix?: string;
  /** If provided, wraps generated rules in a `@media (prefers-color-scheme: dark)` block. */
  readonly darkMediaQuery?: boolean;
}

/**
 * Generate a complete stylesheet for a theme, coupling CSS variables with
 * per-token styling rules. Output targets content produced by `renderHtml`
 * with the matching `classPrefix`.
 */
export function renderThemeStylesheet(theme: Theme, options: ThemeStylesheetOptions = {}): string {
  const prefix = options.classPrefix ?? "streamd";
  const vars = themeToCss(theme, { prefix, selector: `.${prefix}-root` });
  const rules = themeRules(prefix);
  if (options.darkMediaQuery === true && theme.name === "dark") {
    return `@media (prefers-color-scheme: dark) {\n${vars}${rules}}\n`;
  }
  return vars + rules;
}

function themeRules(prefix: string): string {
  const p = prefix;
  return [
    `.${p}-root { color: var(--${p}-color-text); background: var(--${p}-color-background); font-family: var(--${p}-font-family); font-size: var(--${p}-font-size-base); line-height: var(--${p}-line-height); }`,
    `.${p}-root a, .${p}-a { color: var(--${p}-color-link); }`,
    `.${p}-root a:hover, .${p}-a:hover { color: var(--${p}-color-link-hover); }`,
    `.${p}-root h1, .${p}-h1 { font-size: var(--${p}-heading-1); font-weight: var(--${p}-weight-bold); }`,
    `.${p}-root h2, .${p}-h2 { font-size: var(--${p}-heading-2); font-weight: var(--${p}-weight-bold); }`,
    `.${p}-root h3, .${p}-h3 { font-size: var(--${p}-heading-3); font-weight: var(--${p}-weight-bold); }`,
    `.${p}-root h4, .${p}-h4 { font-size: var(--${p}-heading-4); font-weight: var(--${p}-weight-bold); }`,
    `.${p}-root h5, .${p}-h5 { font-size: var(--${p}-heading-5); font-weight: var(--${p}-weight-bold); }`,
    `.${p}-root h6, .${p}-h6 { font-size: var(--${p}-heading-6); font-weight: var(--${p}-weight-bold); }`,
    `.${p}-root p, .${p}-p { margin: var(--${p}-spacing-md) 0; }`,
    `.${p}-root blockquote, .${p}-blockquote { border-left: 4px solid var(--${p}-color-blockquote-accent); color: var(--${p}-color-text-muted); padding-left: var(--${p}-spacing-md); margin: var(--${p}-spacing-md) 0; }`,
    `.${p}-root code, .${p}-code { background: var(--${p}-color-code-background); border-radius: var(--${p}-radius-sm); padding: 0 var(--${p}-spacing-xs); font-family: var(--${p}-code-font-family); font-size: var(--${p}-font-size-sm); }`,
    `.${p}-root pre, .${p}-pre { background: var(--${p}-color-pre-background); border-radius: var(--${p}-radius-md); padding: var(--${p}-spacing-md); overflow-x: auto; }`,
    `.${p}-root pre code, .${p}-pre .${p}-code { background: transparent; padding: 0; font-size: var(--${p}-font-size-sm); line-height: var(--${p}-code-line-height); }`,
    `.${p}-root strong, .${p}-strong { font-weight: var(--${p}-weight-bold); color: var(--${p}-color-strong); }`,
    `.${p}-root em, .${p}-em { color: var(--${p}-color-emphasis); }`,
    `.${p}-root del, .${p}-del { color: var(--${p}-color-text-muted); }`,
    `.${p}-root hr, .${p}-hr { border: 0; border-top: 1px solid var(--${p}-color-border); margin: var(--${p}-spacing-lg) 0; }`,
    `.${p}-root table, .${p}-table { border-collapse: collapse; border: 1px solid var(--${p}-color-border); }`,
    `.${p}-root th, .${p}-root td { border: 1px solid var(--${p}-color-border); padding: var(--${p}-spacing-xs) var(--${p}-spacing-sm); }`,
    `.${p}-root ul, .${p}-ul, .${p}-root ol, .${p}-ol { padding-left: var(--${p}-spacing-lg); }`,
    `.${p}-root li, .${p}-li { margin: var(--${p}-spacing-xs) 0; }`,
    `.${p}-root img, .${p}-img { max-width: 100%; height: auto; }`,
    `.${p}-root br, .${p}-br { line-height: 0; }`,
    "",
  ].join("\n");
}
