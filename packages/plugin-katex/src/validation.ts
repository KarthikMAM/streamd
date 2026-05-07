/**
 * Input validation at the `@streamd/plugin-katex` factory boundary.
 *
 * Every call to {@link katex} funnels through these guards so bad
 * input fails fast with a clear error instead of surfacing inside
 * KaTeX as a confusing stack trace.
 *
 * @module validation
 */

import { describeArgumentType, StreamdArgumentError } from "@streamd/tokens";
import { katexErrorMessage } from "./messages";
import type { KatexDisplayMode, KatexPluginOptions } from "./types";

/**
 * Package identifier embedded in every thrown error's `source` field.
 *
 * Matches the npm package name so consumers can filter or group
 * errors by origin without parsing the stack trace.
 */
const SOURCE = "@streamd/plugin-katex";

/**
 * Valid values for `options.displayMode`.
 *
 * Stored as a `ReadonlySet` so the membership check in
 * {@link assertDisplayMode} is O(1) regardless of how many modes
 * are added in the future.
 */
const DISPLAY_MODE_VALUES: ReadonlySet<KatexDisplayMode> = new Set([
  "auto",
  "always-block",
  "always-inline",
]);

/**
 * Discriminator values for {@link StreamdPluginKatexArgumentError.kind}.
 *
 * Kept as a string-literal union so consumers can `switch` on it
 * exhaustively.
 */
export type StreamdPluginKatexArgumentErrorKind =
  | "options-not-object"
  | "throw-on-error-not-boolean"
  | "display-mode-invalid"
  | "macros-not-object"
  | "macro-value-not-string";

/**
 * Error thrown when a `@streamd/plugin-katex` public-API argument
 * violates its contract.
 *
 * Extends the shared `StreamdArgumentError` so callers can write a
 * single `instanceof StreamdArgumentError` catch across every
 * `@streamd/*` package.
 */
export class StreamdPluginKatexArgumentError extends StreamdArgumentError {
  /** Narrower-typed `kind` shadowing the parent's `string`. */
  public declare readonly kind: StreamdPluginKatexArgumentErrorKind;

  /**
   * Build a new argument error.
   *
   * @param options Structured fields. All required.
   */
  public constructor(options: StreamdPluginKatexArgumentErrorFields) {
    super({
      kind: options.kind,
      source: SOURCE,
      caller: options.caller,
      message: options.message,
    });
    this.name = "StreamdPluginKatexArgumentError";
  }
}

/** Fields accepted by the {@link StreamdPluginKatexArgumentError} constructor. */
export interface StreamdPluginKatexArgumentErrorFields {
  /** Failure-mode discriminator. */
  readonly kind: StreamdPluginKatexArgumentErrorKind;
  /** Public function that rejected the input (e.g. `"katex"`). */
  readonly caller: string;
  /** Human-readable message. Use the helpers in `./messages`. */
  readonly message: string;
}

/**
 * Assert that the caller passed a valid options object.
 *
 * Narrows the `unknown` input to {@link KatexPluginOptions} on
 * return. `undefined` is accepted (equivalent to `{}`) — the factory
 * has sensible defaults for every field.
 *
 * @param input Value received by the `katex()` factory.
 * @param caller Public function name, used in the error message.
 * @throws {StreamdPluginKatexArgumentError} On any validation failure.
 */
export function assertKatexOptions(
  input: unknown,
  caller: string,
): asserts input is KatexPluginOptions | undefined {
  if (input === undefined) return;
  assertOptionsObject(input, caller);
  const opts = input as Record<string, unknown>;
  assertThrowOnError(opts["throwOnError"], caller);
  assertDisplayMode(opts["displayMode"], caller);
  assertMacros(opts["macros"], caller);
}

/**
 * Throw a {@link StreamdPluginKatexArgumentError} with the supplied fields.
 *
 * Centralises the throw so each assertion guard stays a single
 * `if (bad) throwKatexError(…)` line.
 *
 * @param fields Structured error fields forwarded to the constructor.
 * @throws {StreamdPluginKatexArgumentError} Always — this function never returns.
 */
function throwKatexError(fields: StreamdPluginKatexArgumentErrorFields): never {
  throw new StreamdPluginKatexArgumentError(fields);
}

/**
 * Reject null / non-object values for the `options` argument.
 *
 * @param input Value received by the public factory.
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginKatexArgumentError} With kind `"options-not-object"`.
 */
function assertOptionsObject(input: unknown, caller: string): void {
  if (input !== null && typeof input === "object") return;
  throwKatexError({
    kind: "options-not-object",
    caller,
    message: katexErrorMessage.optionsNotObject(caller, describeArgumentType(input)),
  });
}

/**
 * Validate that `throwOnError`, when present, is a boolean.
 *
 * @param value The `options.throwOnError` field (may be `undefined`).
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginKatexArgumentError} With kind `"throw-on-error-not-boolean"`.
 */
function assertThrowOnError(value: unknown, caller: string): void {
  if (value === undefined) return;
  if (typeof value === "boolean") return;
  throwKatexError({
    kind: "throw-on-error-not-boolean",
    caller,
    message: katexErrorMessage.throwOnErrorNotBoolean(caller, describeArgumentType(value)),
  });
}

/**
 * Validate that `displayMode`, when present, is one of the allowed
 * string-literal members.
 *
 * @param value The `options.displayMode` field (may be `undefined`).
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginKatexArgumentError} With kind `"display-mode-invalid"`.
 */
function assertDisplayMode(value: unknown, caller: string): void {
  if (value === undefined) return;
  if (typeof value === "string" && DISPLAY_MODE_VALUES.has(value as KatexDisplayMode)) return;
  throwKatexError({
    kind: "display-mode-invalid",
    caller,
    message: katexErrorMessage.displayModeInvalid(caller, describeArgumentType(value)),
  });
}

/**
 * Validate that `macros`, when present, is a plain object (not null,
 * not an array).
 *
 * @param value The `options.macros` field (may be `undefined`).
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginKatexArgumentError} With kind `"macros-not-object"`.
 */
function assertMacros(value: unknown, caller: string): void {
  if (value === undefined) return;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throwKatexError({
      kind: "macros-not-object",
      caller,
      message: katexErrorMessage.macrosNotObject(caller, describeArgumentType(value)),
    });
  }
  assertMacroValues(value as Record<string, unknown>, caller);
}

/**
 * Iterate macro entries and reject any non-string expansion value.
 *
 * @param macros The validated macros object (known to be non-null,
 *   non-array, typeof "object").
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginKatexArgumentError} With kind
 *   `"macro-value-not-string"` for the first offending entry.
 */
function assertMacroValues(macros: Record<string, unknown>, caller: string): void {
  for (const [name, expansion] of Object.entries(macros)) {
    if (typeof expansion === "string") continue;
    throwKatexError({
      kind: "macro-value-not-string",
      caller,
      message: katexErrorMessage.macroValueNotString(caller, name, describeArgumentType(expansion)),
    });
  }
}
