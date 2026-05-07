/**
 * Plugin ABI errors.
 *
 * Extends the shared `StreamdArgumentError` so a single cross-package
 * `instanceof` catch covers validation + ABI mismatch failures.
 *
 * The `kind` discriminator distinguishes four failure modes:
 *  - `"token-schema-mismatch"` — plugin declared a different token schema
 *    version than the parser emits.
 *  - `"missing-requires"` — plugin does not declare `requires`. Every plugin
 *    must declare its expected token schema so third-party plugins fail
 *    loud when the monorepo bumps its ABI.
 *  - `"sanitize-not-last"` — the `sanitize` plugin appears in the pipeline
 *    but is not the final entry. Any plugin placed after `sanitize` can
 *    reintroduce the data `sanitize` just scrubbed (raw HTML, unsafe
 *    links, dangerous meta attributes).
 *  - `"transform-failed"` — a plugin's `transform` threw. The original
 *    error is preserved on the `cause` field; the plugin name is on
 *    `pluginName`.
 *
 * @module errors
 */

import { StreamdArgumentError } from "@streamd/tokens";

/** Source package identifier used on every thrown error. */
const SOURCE = "@streamd/plugins";

/**
 * Discriminator values for {@link StreamdPluginAbiError.kind}.
 *
 * Kept as a string literal union so consumers can `switch` on it
 * exhaustively.
 */
export type StreamdPluginAbiErrorKind =
  | "token-schema-mismatch"
  | "missing-requires"
  | "sanitize-not-last"
  | "transform-failed";

/**
 * Error thrown by `applyPlugins` for any plugin-ABI violation.
 *
 * Carries enough structured detail to log or surface in a UI without
 * parsing the message string. Subclasses `StreamdArgumentError` so
 * callers can catch every `@streamd/*` input-validation failure with
 * a single `instanceof`.
 */
export class StreamdPluginAbiError extends StreamdArgumentError {
  /** Narrower-typed `kind` shadowing the parent's `string`. */
  public declare readonly kind: StreamdPluginAbiErrorKind;

  /** Plugin that triggered the error, or `null` when not applicable. */
  public readonly pluginName: string | null;

  /**
   * Schema version the plugin expected. `null` when the error is not
   * about schema-version values (e.g. `"sanitize-not-last"`).
   */
  public readonly expected: number | null;

  /**
   * Schema version the parser reports. `null` when not applicable.
   */
  public readonly actual: number | null;

  /**
   * Original error from a failed `plugin.transform` invocation, or
   * `undefined` when this error was not raised by a thrown transform.
   *
   * Also attached as the built-in `Error.cause` property for
   * devtools / logging integration.
   */
  public override readonly cause?: unknown;

  /**
   * Build a new plugin-ABI error.
   *
   * @param options Structured fields. `kind`, `caller`, `message` are required;
   *   `pluginName`, `expected`, `actual`, `cause` are optional.
   */
  public constructor(options: StreamdPluginAbiErrorFields) {
    super({
      kind: options.kind,
      source: SOURCE,
      caller: options.caller,
      message: options.message,
    });
    this.name = "StreamdPluginAbiError";
    this.pluginName = options.pluginName ?? null;
    this.expected = options.expected ?? null;
    this.actual = options.actual ?? null;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/**
 * Fields accepted by the `StreamdPluginAbiError` constructor.
 *
 * All fields other than `kind`, `caller`, and `message` are optional
 * because different failure modes populate different subsets
 * (e.g. `"sanitize-not-last"` has no `expected`/`actual`).
 */
export interface StreamdPluginAbiErrorFields {
  /** Failure-mode discriminator. */
  readonly kind: StreamdPluginAbiErrorKind;
  /** Public function that rejected the pipeline (always `"applyPlugins"`). */
  readonly caller: string;
  /** Human-readable message. Use the helpers in `./messages`. */
  readonly message: string;
  /** Name of the offending plugin, when known. */
  readonly pluginName?: string;
  /** Expected token-schema version. Only set for schema errors. */
  readonly expected?: number;
  /** Actual token-schema version. Only set for schema errors. */
  readonly actual?: number;
  /** Original error thrown by `plugin.transform`. Only set for transform-failed. */
  readonly cause?: unknown;
}
