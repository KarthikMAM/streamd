/**
 * @streamd/plugins — plugin system and built-in plugins.
 *
 * @module index
 */

export type { FrontmatterResult } from "./builtins/frontmatter";
export { frontmatter, preprocessSource } from "./builtins/frontmatter";
export type { HeadingAnchorsOptions } from "./builtins/heading-anchors";

export { headingAnchors } from "./builtins/heading-anchors";
export type { HighlightCodeOptions, HighlightFn } from "./builtins/highlight-code";
export { highlightCode } from "./builtins/highlight-code";
export type { LinkAttributesOptions, LinkClassification } from "./builtins/link-attributes";
export { linkAttributes } from "./builtins/link-attributes";
export { isSafeAttributeName, SAFE_ATTR_ALLOWLIST } from "./builtins/safe-attrs";
export type { SanitizeOptions } from "./builtins/sanitize";

export { sanitize } from "./builtins/sanitize";
export type { StreamdPluginAbiErrorFields, StreamdPluginAbiErrorKind } from "./errors";
export { StreamdPluginAbiError } from "./errors";
export type {
  ApplyPluginsOptions,
  ApplyPluginsResult,
  Plugin,
  PluginContext,
  PluginRequirements,
} from "./types";
export type { InlineVisitResult, Visitor, VisitResult } from "./walk";
export { applyPlugins, composePlugins, walk } from "./walk";
