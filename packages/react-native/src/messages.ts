/**
 * Canonical error message strings for `@streamd/react-native`.
 *
 * @module messages
 */

/**
 * Frozen map of error message factories for `@streamd/react-native`.
 *
 * Each key produces a human-readable diagnostic string that includes the
 * caller name and the offending value type. Used by the validation layer
 * to construct `StreamdReactNativeArgumentError` instances.
 */
export const reactNativeErrorMessage = {
  /** Produces a diagnostic when `tokens` is not an array. */
  tokensNotArray: (caller: string, received: string) =>
    `${caller}: expected tokens to be an Array, received ${received}`,
  /** Produces a diagnostic when a token has an unrecognised `type` value. */
  unexpectedTokenKind: (caller: string, kind: string) =>
    `${caller}: unexpected token kind ${kind} — tree is malformed or out of sync with @streamd/parser`,
  /** Produces a diagnostic when neither `source` nor `tokens` is provided. */
  missingInput: (caller: string) =>
    `${caller}: neither \`source\` nor \`tokens\` was provided — supply one of them`,
  /** Produces a diagnostic when a streaming chunk is not a string. */
  invalidChunk: (caller: string, received: string) =>
    `${caller}: expected chunk to be a string, received ${received}`,
} as const;
