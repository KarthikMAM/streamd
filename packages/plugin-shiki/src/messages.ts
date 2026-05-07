/**
 * Canonical error message strings for `@streamd/plugin-shiki`.
 *
 * Centralised so thrown-error text is identical to the text used in
 * docs and tests.
 *
 * @module messages
 */

/** Message templates indexed by error kind. */
export const shikiErrorMessage = {
  /**
   * Message for when the factory receives no argument at all.
   *
   * @param caller Public function name that rejected the input.
   * @returns Formatted error string.
   */
  missingOptions: (caller: string) =>
    `${caller}: expected options object with { themes: { light, dark } }, received no argument`,

  /**
   * Message for when the options argument is not an object.
   *
   * @param caller Public function name that rejected the input.
   * @param received Human-readable description of the actual type.
   * @returns Formatted error string.
   */
  optionsNotObject: (caller: string, received: string) =>
    `${caller}: expected options to be an object, received ${received}`,

  /**
   * Message for when `options.themes` is missing entirely.
   *
   * @param caller Public function name that rejected the input.
   * @returns Formatted error string.
   */
  themesMissing: (caller: string) =>
    `${caller}: options.themes is required — pass { themes: { light: "github-light", dark: "github-dark" } }`,

  /**
   * Message for when `options.themes` is present but not an object.
   *
   * @param caller Public function name that rejected the input.
   * @param received Human-readable description of the actual type.
   * @returns Formatted error string.
   */
  themesNotObject: (caller: string, received: string) =>
    `${caller}: options.themes must be a { light, dark } object, received ${received}`,

  /**
   * Message for when a single theme slot is not a non-empty string.
   *
   * @param caller Public function name that rejected the input.
   * @param which Which theme slot failed — `"light"` or `"dark"`.
   * @param received Human-readable description of the actual type.
   * @returns Formatted error string.
   */
  themeNotString: (caller: string, which: "light" | "dark", received: string) =>
    `${caller}: options.themes.${which} must be a non-empty string, received ${received}`,

  /**
   * Message for when `options.langs` is present but not an array.
   *
   * @param caller Public function name that rejected the input.
   * @param received Human-readable description of the actual type.
   * @returns Formatted error string.
   */
  langsNotArray: (caller: string, received: string) =>
    `${caller}: options.langs must be an Array of strings, received ${received}`,

  /**
   * Message for when `options.loadTheme` is present but not a function.
   *
   * @param caller Public function name that rejected the input.
   * @param received Human-readable description of the actual type.
   * @returns Formatted error string.
   */
  loadThemeNotFunction: (caller: string, received: string) =>
    `${caller}: options.loadTheme must be a function, received ${received}`,

  /**
   * Message for when `options.onUnknownLang` is not a valid enum value.
   *
   * @param caller Public function name that rejected the input.
   * @param received Human-readable description of the actual value.
   * @returns Formatted error string.
   */
  onUnknownLangInvalid: (caller: string, received: string) =>
    `${caller}: options.onUnknownLang must be "ignore" | "error" | "plaintext", received ${received}`,

  /**
   * Message for when a code block's language is not loaded and
   * `onUnknownLang` is set to `"error"`.
   *
   * @param lang The unrecognised language identifier from the fenced block.
   * @returns Formatted error string.
   */
  unknownLanguage: (lang: string) =>
    `shiki plugin: code block language "${lang}" is not in the configured langs list (onUnknownLang="error")`,
} as const;
