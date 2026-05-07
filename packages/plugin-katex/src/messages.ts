/**
 * Canonical error message strings for `@streamd/plugin-katex`.
 *
 * Centralised so thrown-error text is identical to the text used in
 * docs and tests.
 *
 * @module messages
 */

/**
 * Message templates indexed by error kind.
 *
 * Each property is a factory that interpolates the caller name and
 * the `describeArgumentType` output into a human-readable sentence.
 * Keeping them here guarantees test assertions match thrown text
 * without duplicating string literals.
 */
export const katexErrorMessage = {
  /**
   * Produce the message for a non-object `options` argument.
   *
   * @param caller Public function name (e.g. `"katex"`).
   * @param received Human-readable type description of the bad value.
   * @returns Formatted error message.
   */
  optionsNotObject: (caller: string, received: string) =>
    `${caller}: expected options to be an object, received ${received}`,

  /**
   * Produce the message for a non-boolean `throwOnError` field.
   *
   * @param caller Public function name.
   * @param received Human-readable type description of the bad value.
   * @returns Formatted error message.
   */
  throwOnErrorNotBoolean: (caller: string, received: string) =>
    `${caller}: options.throwOnError must be a boolean, received ${received}`,

  /**
   * Produce the message for an invalid `displayMode` value.
   *
   * @param caller Public function name.
   * @param received Human-readable type description of the bad value.
   * @returns Formatted error message.
   */
  displayModeInvalid: (caller: string, received: string) =>
    `${caller}: options.displayMode must be "auto" | "always-block" | "always-inline", received ${received}`,

  /**
   * Produce the message for a non-object `macros` field.
   *
   * @param caller Public function name.
   * @param received Human-readable type description of the bad value.
   * @returns Formatted error message.
   */
  macrosNotObject: (caller: string, received: string) =>
    `${caller}: options.macros must be an object of string macro expansions, received ${received}`,

  /**
   * Produce the message for a non-string value inside the `macros` map.
   *
   * @param caller Public function name.
   * @param name The macro key whose value failed validation.
   * @param received Human-readable type description of the bad value.
   * @returns Formatted error message.
   */
  macroValueNotString: (caller: string, name: string, received: string) =>
    `${caller}: options.macros[${JSON.stringify(name)}] must be a string, received ${received}`,
} as const;
