/**
 * Canonical error message strings for `@streamd/cli`.
 *
 * Keeping messages as named constants means:
 * - Tests can assert stable messages without fragile substring matching.
 * - Logs contain grep-able stable phrases.
 * - Translation (if ever needed) becomes a single-file change.
 *
 * @module messages
 */

/**
 * Message templates indexed by error kind.
 *
 * Each factory produces a stable, grep-able error string. Tests assert
 * against these directly so messages never drift from the validation
 * layer.
 */
export const cliErrorMessage = {
  /**
   * @param flag The unrecognized flag token (e.g. `"--foo"`).
   * @returns Human-readable message directing the user to `--help`.
   */
  unknownFlag: (flag: string) =>
    `unknown flag ${flag} — see 'streamd --help' for supported options`,
  /**
   * @param received The invalid theme value the user supplied.
   * @returns Message listing the valid theme choices.
   */
  unknownTheme: (received: string) =>
    `--theme must be one of 'light', 'dark', 'none' — received '${received}'`,
  /**
   * @param received The invalid stream mode the user supplied.
   * @returns Message listing the valid stream mode choices.
   */
  unknownStream: (received: string) =>
    `--stream must be one of 'auto', 'delta', 'full', 'off' — received '${received}'`,
  /**
   * @param flag The flag that was passed without a value.
   * @returns Message indicating the flag requires a value argument.
   */
  missingValue: (flag: string) => `${flag} requires a value`,
  /**
   * @param arg The unexpected positional argument.
   * @returns Message explaining streamd reads from stdin, not positionals.
   */
  positionalNotAllowed: (arg: string) =>
    `unexpected positional argument '${arg}' — streamd reads markdown from stdin`,
  /**
   * @param a First conflicting flag (e.g. `"--gfm"`).
   * @param b Second conflicting flag (e.g. `"--no-gfm"`).
   * @returns Message naming both flags that cannot coexist.
   */
  conflictingFlag: (a: string, b: string) => `${a} and ${b} cannot both be set`,
  /**
   * @returns Message explaining `--wrap-root` depends on `--class-prefix`.
   */
  wrapRootRequiresPrefix: () => "--wrap-root requires --class-prefix to know what class to emit",
  /**
   * @param received Type description of the non-array value.
   * @returns Message for the public-API boundary check on `run(argv)`.
   */
  argvNotArray: (received: string) =>
    `run: expected argv to be an Array of strings, received ${received}`,
  /**
   * @param index Zero-based index of the offending item.
   * @param received Type description of the non-string item.
   * @returns Message identifying which argv element failed the type check.
   */
  argvItemNotString: (index: number, received: string) =>
    `run: expected argv[${index}] to be a string, received ${received}`,
  /**
   * @returns Message for the explicit-empty-string guard on `--class-prefix`.
   */
  emptyClassPrefix: () => "--class-prefix value must not be empty",
} as const;
