/**
 * Shared error types for the streamd public API boundary.
 *
 * Every published package that validates caller input extends
 * `StreamdArgumentError` so consumers can write a single
 * `instanceof StreamdArgumentError` catch to cover all of them.
 *
 * @module errors
 */

/**
 * Base class for every "you called the public API with the wrong kind
 * of value" error thrown by a `@streamd/*` package.
 *
 * Extends `TypeError` so existing JavaScript `try { … } catch` handlers
 * that already distinguish `TypeError` from other errors continue to
 * work.
 *
 * Constructor enforces a structured shape:
 * - `kind`: short discriminator string (e.g. "tokens-not-array")
 * - `source`: the `@streamd/<package>` that raised the error
 * - `caller`: the public function name, for error context
 * - `message`: human-readable explanation
 *
 * Subclasses override `name` so stack traces print something like
 * `StreamdHtmlArgumentError` rather than the base name.
 */
export class StreamdArgumentError extends TypeError {
  /** Discriminator — stable across versions so consumers can switch on it. */
  public readonly kind: string;

  /** Which `@streamd/*` package threw — for log triage. */
  public readonly source: string;

  /** Name of the public function that rejected the input. */
  public readonly caller: string;

  /**
   * Build a new argument error.
   *
   * @param options Structured fields. All required.
   */
  public constructor(options: StreamdArgumentErrorOptions) {
    super(options.message);
    this.name = "StreamdArgumentError";
    this.kind = options.kind;
    this.source = options.source;
    this.caller = options.caller;
  }
}

/**
 * Options accepted by the `StreamdArgumentError` constructor.
 *
 * See the class doc for field semantics.
 */
export interface StreamdArgumentErrorOptions {
  /** Stable discriminator string (e.g. `"tokens-not-array"`). */
  readonly kind: string;
  /** The `@streamd/<package>` that raised the error. */
  readonly source: string;
  /** Public function name that rejected the input. */
  readonly caller: string;
  /** Human-readable explanation of the failure. */
  readonly message: string;
}

/**
 * Describe the JS type of a runtime value for inclusion in an error
 * message. Returns `"null"` for `null`, `"Array"` for arrays, and
 * `typeof value` otherwise.
 *
 * @param value Any runtime value.
 * @returns A short human-readable type label.
 */
export function describeArgumentType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "Array";
  return typeof value;
}
