/**
 * Public types for @streamd/html.
 *
 * @module types
 */

import type { Token, TokensList, TokenTypeValue } from "@streamd/parser";
import type { Plugin } from "@streamd/plugins";
import type { TaskListCheckboxMode } from "@streamd/tokens";

/**
 * Mapped type that extracts the concrete token interface whose `type`
 * field matches the given string literal `K`. Enables type-safe
 * component overrides: `components.heading` receives a `HeadingToken`.
 */
export type TokenByType<K extends TokenTypeValue> = Extract<Token, { type: K }>;

/**
 * Context object passed to component override functions. Provides
 * escape helpers, class-prefix resolution, and a recursive render
 * callback so overrides can delegate to the default for children.
 */
export interface HtmlRenderContext {
  /** Escape HTML entities in text content. */
  readonly escapeHtml: (s: string) => string;
  /** Escape a value for use inside an HTML attribute. */
  readonly escapeAttr: (s: string) => string;
  /** Current CSS class prefix (empty string when disabled). */
  readonly classPrefix: string;
  /** Render a child token using the default renderer. */
  readonly render: (token: Token) => string;
}

/**
 * Component override map — one optional function per token type.
 * Each function receives the typed token and a render context,
 * and returns an HTML string that replaces the default output.
 */
export type HtmlComponents = {
  readonly [K in TokenTypeValue]?: (token: TokenByType<K>, ctx: HtmlRenderContext) => string;
};

/** Options controlling HTML emission. */
export interface RenderHtmlOptions {
  /** Omit language class on fenced code blocks. Default: false. */
  readonly omitCodeLanguageClass?: boolean;
  /** XHTML-style void tags (`<br />`) vs HTML5 (`<br>`). Default: true. */
  readonly xhtml?: boolean;
  /**
   * Base CSS class prefix — applied to block-level tags as
   * `class="<prefix>-<kind>"`. Default: undefined (no classes).
   */
  readonly classPrefix?: string;
  /**
   * If true, wrap the whole output in a `<div class="<prefix>-root">`
   * container. Requires `classPrefix`. Default: false.
   */
  readonly wrapRoot?: boolean;
  /**
   * How to render GFM task-list checkboxes. Default: `"disabled"`.
   */
  readonly taskListCheckboxes?: TaskListCheckboxMode;
  /**
   * How to render math tokens (`MathInline`, `MathBlock`). Default: `"span-class"`.
   */
  readonly math?: "span-class" | "tex-delim" | "none";
  /** Plugins applied to the token tree before rendering. Runs in order. */
  readonly plugins?: ReadonlyArray<Plugin>;
  /**
   * Component override map. Each key is a token type string; the value
   * is a function `(token, ctx) => string` that replaces the default
   * renderer for that token type.
   */
  readonly components?: HtmlComponents;
}

/** Public signature for the top-level render entry point. */
export type RenderHtml = (tokens: TokensList, options?: RenderHtmlOptions) => string;
