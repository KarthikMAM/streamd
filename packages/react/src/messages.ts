/**
 * Canonical error message strings for `@streamd/react`.
 *
 * @module messages
 */

/**
 * Canonical error message factories for `@streamd/react` public-API
 * boundary validation. Each factory produces a deterministic string
 * that includes the caller name and the offending value so diagnostics
 * are actionable without a debugger.
 */
export const reactErrorMessage = {
  /** Message for when `tokens` is not an array. */
  tokensNotArray: (caller: string, received: string) =>
    `${caller}: expected tokens to be an Array, received ${received}`,
  /** Message for an unrecognised token type in the tree. */
  unexpectedTokenKind: (caller: string, kind: string) =>
    `${caller}: unexpected token kind ${kind} — tree is malformed or out of sync with @streamd/parser`,
  /** Message for when neither `source` nor `tokens` was provided. */
  missingInput: (caller: string) =>
    `${caller}: neither \`source\` nor \`tokens\` was provided — supply one of them`,
  /** Message for when a streaming chunk is not a string. */
  invalidChunk: (caller: string, received: string) =>
    `${caller}: expected chunk to be a string, received ${received}`,
} as const;
