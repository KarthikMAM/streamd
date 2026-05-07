/**
 * @streamd/plugin-shiki — Shiki adapter for the streamd plugin pipeline.
 *
 * @module index
 */

export { shiki } from "./shiki";
export type { ShikiPluginOptions, ShikiUnknownLangBehavior } from "./types";
export {
  StreamdPluginShikiArgumentError,
  type StreamdPluginShikiArgumentErrorFields,
  type StreamdPluginShikiArgumentErrorKind,
} from "./validation";
