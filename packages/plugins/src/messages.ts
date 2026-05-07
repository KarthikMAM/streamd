/**
 * Canonical error message strings for `@streamd/plugins`.
 *
 * Centralised so the thrown-error text is identical to the text used
 * in docs and tests.
 *
 * @module messages
 */

/**
 * Canonical error-message factory map keyed by `StreamdPluginAbiErrorKind`.
 *
 * Each entry is a function that accepts the context-specific parameters
 * (plugin name, version numbers, etc.) and returns the full human-readable
 * message string. Centralising messages here ensures the thrown-error text
 * is identical to the text used in documentation and test assertions.
 */
export const pluginsErrorMessage = {
  /**
   * Built when a plugin's `requires.tokenSchema` disagrees with the
   * parser's `TOKEN_SCHEMA_VERSION`.
   */
  tokenSchemaMismatch: (pluginName: string, expected: number, actual: number) =>
    `applyPlugins: plugin "${pluginName}" requires token schema v${expected} but parser is at v${actual}. Update the plugin or the parser.`,

  /**
   * Built when a plugin omits the `requires` field. Every plugin must
   * declare its expected token schema so consumers fail fast on ABI
   * skew — see the "Plugin ABI" section of the README for how to
   * declare it.
   */
  missingRequires: (pluginName: string) =>
    `applyPlugins: plugin "${pluginName}" does not declare a "requires" field. Every plugin must declare { requires: { tokenSchema: TOKEN_SCHEMA_VERSION } } from "@streamd/parser". See @streamd/plugins README "Plugin ABI".`,

  /**
   * Built when the plugin pipeline contains `sanitize` but not as the
   * final entry. Any plugin after `sanitize` could reintroduce the raw
   * HTML, unsafe links, or dangerous meta attributes that `sanitize`
   * just stripped.
   */
  sanitizeNotLast: (index: number, total: number) =>
    `applyPlugins: "sanitize" must be the last plugin in the pipeline but was at index ${index} of ${total}. Any plugin after sanitize() can reintroduce unsafe output — reorder so sanitize() runs last.`,

  /**
   * Built when a plugin's `transform` throws. The original error is
   * attached as the `cause` property on the wrapping
   * `StreamdPluginAbiError`.
   */
  transformFailed: (pluginName: string, originalMessage: string) =>
    `applyPlugins: plugin "${pluginName}" transform threw: ${originalMessage}`,
} as const;
