/**
 * @streamd/html — HTML renderer for streamd token trees.
 *
 * Zero-dependency, synchronous, whitespace-tolerant output suitable for
 * comparison against CommonMark and GFM reference fixtures.
 *
 * @module index
 */

export { decodeEntities, escapeAttr, escapeHtml, normalizeUrl } from "./escape";
export { renderHtml } from "./render";
export type { StreamHtmlOptions, StreamHtmlResult, ThemeStylesheetOptions } from "./streaming";
export { renderThemeStylesheet, streamHtml } from "./streaming";
export type { RenderHtml, RenderHtmlOptions } from "./types";
export type { StreamdHtmlArgumentErrorFields } from "./validation";
export { StreamdHtmlArgumentError } from "./validation";
