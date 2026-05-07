/**
 * Public types for @streamd/html.
 *
 * @module types
 */

import type { TokensList } from "@streamd/parser";
import type { Plugin } from "@streamd/plugins";
import type { MathRenderMode, TaskListCheckboxMode } from "@streamd/tokens";

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
  readonly math?: MathRenderMode;
  /** Plugins applied to the token tree before rendering. Runs in order. */
  readonly plugins?: ReadonlyArray<Plugin>;
  /**
   * Opt in to honouring the `token.meta.html` passthrough that plugins may
   * attach (e.g. `@streamd/plugins`' `highlightCode` builtin emits a
   * pre-rendered `<pre>` string there). Default: `false`.
   *
   * # Security
   *
   * When `false` (the default), renderers IGNORE `meta.html` entirely and
   * render the token normally. Setting this to `true` causes the renderer
   * to splice `meta.html` verbatim into the output — no further escaping,
   * no validation. Anything a plugin writes into `meta.html` is trusted
   * to be well-formed, safe HTML.
   *
   * `sanitize()` from `@streamd/plugins` does NOT walk `token.meta`. That
   * means a plugin (third-party or in-house) that sets
   * `meta.html = "<script>…"` bypasses the sanitizer entirely. Only enable
   * this flag when you control every plugin in the `plugins` pipeline and
   * have verified that each plugin produces safe HTML output (e.g. a
   * syntax highlighter that emits only `<span>` / `<code>` elements with
   * escaped text content).
   *
   * Leaving this flag `false` is the safe default for any caller that
   * accepts plugins from external configuration or runs plugins authored
   * outside the trust boundary.
   */
  readonly allowDangerousMetaHtml?: boolean;
}

/** Public signature for the top-level render entry point. */
export type RenderHtml = (tokens: TokensList, options?: RenderHtmlOptions) => string;
