/**
 * Canonical error message strings for `@streamd/html`.
 *
 * Keeping messages as named constants instead of inline template
 * literals means:
 * - Tests can assert stable messages without fragile substring matching
 * - Localization (if ever needed) becomes a single-file change
 * - Logs contain grep-able stable phrases
 *
 * @module messages
 */

/**
 * Error-message factory map for `@streamd/html`.
 *
 * Each key is an error kind (matching `StreamdHtmlArgumentErrorFields.kind`)
 * and each value is a factory function that accepts contextual parameters
 * and returns a fully-formed, human-readable error message string.
 */
export const htmlErrorMessage = {
  /**
   * Produces the message for a `tokens-not-array` error.
   *
   * @param caller - Name of the public API function that received bad input.
   * @param received - Human-readable description of the actual type received.
   * @returns Formatted error message string.
   */
  tokensNotArray: (caller: string, received: string) =>
    `${caller}: expected tokens to be an Array, received ${received}`,
  /**
   * Produces the message for a `source-not-string` error.
   *
   * @param caller - Name of the public API function that received bad input.
   * @param received - Human-readable description of the actual type received.
   * @returns Formatted error message string.
   */
  sourceNotString: (caller: string, received: string) =>
    `${caller}: expected source to be a string, received ${received}`,
  /**
   * Produces the message for an `unknown-token-type` error.
   *
   * @param caller - Name of the dispatch site that encountered the unknown type.
   * @param kind - String representation of the unrecognised token type discriminator.
   * @returns Formatted error message string.
   */
  unknownTokenType: (caller: string, kind: string) =>
    `${caller}: unknown token type ${kind} — tree is malformed or out of sync with @streamd/parser`,
} as const;
