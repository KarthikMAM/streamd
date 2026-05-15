/**
 * Compose {@link CliOptions} into the concrete pieces the pipeline
 * needs: parser options, render options, plugin list, theme
 * stylesheet.
 *
 * Split from `pipeline.ts` so each transformation can be tested and
 * reused without pulling in the stdin/stdout plumbing.
 *
 * @module compose
 */

import { renderThemeStylesheet, type StreamHtmlOptions } from "@streamd/html";
import type { ParseOptions } from "@streamd/parser";
import { headingAnchors, linkAttributes, type Plugin, sanitize } from "@streamd/plugins";
import { darkTheme, lightTheme } from "@streamd/tokens";
import type { CliOptions } from "./types";

/**
 * Default CSS class prefix for the theme stylesheet when the user has
 * not set `--class-prefix`. Uses the package name so generated classes
 * (e.g. `.streamd-heading`) are recognisable and unlikely to collide
 * with consumer stylesheets.
 */
const DEFAULT_THEME_PREFIX = "streamd";

/**
 * Build the {@link ParseOptions} the streamd parser expects from the
 * subset of CLI flags that influence parsing.
 *
 * @param options Validated CLI options.
 * @returns ParseOptions passed to the parser on every chunk.
 */
export function buildParseOptions(options: CliOptions): ParseOptions {
  return { gfm: options.gfm, math: options.math };
}

/**
 * Build the plugin pipeline for the render stage.
 *
 * Order is significant — plugins are applied in array order.
 * `headingAnchors` and `linkAttributes` annotate tokens; `sanitize`
 * rewrites unsafe URLs and filters `meta.attrs`.
 *
 * @param options Validated CLI options.
 * @returns A plugin array suitable for `renderHtml({ plugins })`.
 */
export function buildPlugins(options: CliOptions): Array<Plugin> {
  const plugins: Array<Plugin> = [];
  if (options.anchors) plugins.push(headingAnchors());
  if (options.linkAttrs) plugins.push(linkAttributes());
  if (options.sanitize) plugins.push(sanitize());
  return plugins;
}

/**
 * Build the combined parse + render options passed to `streamHtml`.
 *
 * `classPrefix`, `wrapRoot`, `xhtml` flow into the renderer; `gfm` /
 * `math` flow into the parser.
 *
 * @param options Validated CLI options.
 * @returns StreamHtmlOptions forwarded to `@streamd/html`.
 */
export function buildStreamOptions(options: CliOptions): StreamHtmlOptions {
  const shared: StreamHtmlOptions = {
    parse: buildParseOptions(options),
    plugins: buildPlugins(options),
    xhtml: options.xhtml,
    wrapRoot: options.wrapRoot,
  };

  if (options.classPrefix !== "") {
    return { ...shared, classPrefix: options.classPrefix };
  }

  return shared;
}

/**
 * Build the theme stylesheet when `--theme` is set to a concrete
 * palette. Returns `null` for `"none"` so the caller knows to skip
 * emitting a `<style>` block entirely.
 *
 * @param options Validated CLI options.
 * @returns Complete `<style>...</style>` block, or `null`.
 */
export function buildThemeStyleBlock(options: CliOptions): string | null {
  if (options.theme === "none") return null;

  const theme = options.theme === "dark" ? darkTheme : lightTheme;
  const prefix = options.classPrefix === "" ? DEFAULT_THEME_PREFIX : options.classPrefix;
  const css = renderThemeStylesheet(theme, { classPrefix: prefix });

  return `<style>${css}</style>\n`;
}
