/**
 * Input validation at the `@streamd/plugin-shiki` factory boundary.
 *
 * Every call to {@link shiki} funnels through these guards so bad
 * input fails fast with a clear error instead of surfacing deep
 * inside Shiki's `createHighlighter` as an opaque stack trace.
 *
 * @module validation
 */

import { describeArgumentType, StreamdArgumentError } from "@streamd/tokens";
import { shikiErrorMessage } from "./messages";
import type { ShikiPluginOptions, ShikiUnknownLangBehavior } from "./types";

/** Package source identifier attached to every thrown error. */
const SOURCE = "@streamd/plugin-shiki";

/** Valid values for `options.onUnknownLang`. */
const UNKNOWN_LANG_VALUES: ReadonlySet<ShikiUnknownLangBehavior> = new Set([
  "ignore",
  "error",
  "plaintext",
]);

/**
 * Discriminator values for {@link StreamdPluginShikiArgumentError.kind}.
 *
 * Kept as a string-literal union so consumers can `switch` on it
 * exhaustively.
 */
export type StreamdPluginShikiArgumentErrorKind =
  | "missing-options"
  | "options-not-object"
  | "themes-missing"
  | "themes-not-object"
  | "theme-not-string"
  | "langs-not-array"
  | "load-theme-not-function"
  | "on-unknown-lang-invalid"
  | "unknown-language";

/**
 * Error thrown when a `@streamd/plugin-shiki` public-API argument
 * violates its contract, or when a code block's language fails the
 * `onUnknownLang: "error"` gate.
 *
 * Extends the shared `StreamdArgumentError` so callers can write a
 * single `instanceof StreamdArgumentError` catch across every
 * `@streamd/*` package.
 */
export class StreamdPluginShikiArgumentError extends StreamdArgumentError {
  /** Narrower-typed `kind` shadowing the parent's `string`. */
  public declare readonly kind: StreamdPluginShikiArgumentErrorKind;

  /**
   * Build a new argument error.
   *
   * @param options Structured fields forwarded to the parent. All required.
   */
  public constructor(options: StreamdPluginShikiArgumentErrorFields) {
    super({
      kind: options.kind,
      source: SOURCE,
      caller: options.caller,
      message: options.message,
    });
    this.name = "StreamdPluginShikiArgumentError";
  }
}

/** Fields accepted by the {@link StreamdPluginShikiArgumentError} constructor. */
export interface StreamdPluginShikiArgumentErrorFields {
  /** Failure-mode discriminator. */
  readonly kind: StreamdPluginShikiArgumentErrorKind;
  /** Public function that rejected the input (e.g. `"shiki"`). */
  readonly caller: string;
  /** Human-readable message. Use the helpers in `./messages`. */
  readonly message: string;
}

/**
 * Assert that the caller passed an object for `options` and that it
 * contains a well-shaped `themes` entry.
 *
 * Narrows the `unknown` input to {@link ShikiPluginOptions} on return
 * so downstream code can read the fields without further casts.
 *
 * @param input Value received by the `shiki()` factory.
 * @param caller Public function name, used in the error message.
 * @throws {StreamdPluginShikiArgumentError} On any validation failure.
 */
export function assertShikiOptions(
  input: unknown,
  caller: string,
): asserts input is ShikiPluginOptions {
  assertOptionsObject(input, caller);

  const opts = input as Record<string, unknown>;

  assertThemes(opts["themes"], caller);
  assertLangs(opts["langs"], caller);
  assertLoadTheme(opts["loadTheme"], caller);
  assertOnUnknownLang(opts["onUnknownLang"], caller);
}

/**
 * Throw a {@link StreamdPluginShikiArgumentError} with the supplied fields.
 *
 * Centralises the `throw new` pattern so each guard is a single
 * function call rather than a multi-line throw statement.
 *
 * @param fields Structured error fields.
 * @throws {StreamdPluginShikiArgumentError} Always.
 */
function throwShikiError(fields: StreamdPluginShikiArgumentErrorFields): never {
  throw new StreamdPluginShikiArgumentError(fields);
}

/**
 * Reject null, undefined, or non-object values for the `options` argument.
 *
 * @param input Raw value passed to the factory.
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginShikiArgumentError} With `missing-options` or
 *   `options-not-object` kind.
 */
function assertOptionsObject(input: unknown, caller: string): void {
  if (input === undefined) {
    throwShikiError({
      kind: "missing-options",
      caller,
      message: shikiErrorMessage.missingOptions(caller),
    });
  }

  const isNullOrNonObject = input === null || typeof input !== "object";

  if (isNullOrNonObject) {
    throwShikiError({
      kind: "options-not-object",
      caller,
      message: shikiErrorMessage.optionsNotObject(caller, describeArgumentType(input)),
    });
  }
}

/**
 * Validate the `themes` entry: required, object-shaped, with string
 * `light` and `dark` slots.
 *
 * @param themes Value of `options.themes`.
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginShikiArgumentError} With `themes-missing`,
 *   `themes-not-object`, or `theme-not-string` kind.
 */
function assertThemes(themes: unknown, caller: string): void {
  const isMissing = themes === undefined || themes === null;

  if (isMissing) {
    throwShikiError({
      kind: "themes-missing",
      caller,
      message: shikiErrorMessage.themesMissing(caller),
    });
  }

  if (typeof themes !== "object") {
    throwShikiError({
      kind: "themes-not-object",
      caller,
      message: shikiErrorMessage.themesNotObject(caller, describeArgumentType(themes)),
    });
  }

  const pair = themes as Record<string, unknown>;

  assertThemeEntry(pair["light"], "light", caller);
  assertThemeEntry(pair["dark"], "dark", caller);
}

/**
 * Validate a single theme slot (`light` or `dark`) as a non-empty string.
 *
 * @param value Value of the theme slot.
 * @param which Which slot is being validated — `"light"` or `"dark"`.
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginShikiArgumentError} With `theme-not-string` kind.
 */
function assertThemeEntry(value: unknown, which: "light" | "dark", caller: string): void {
  const isValidTheme = typeof value === "string" && value.length > 0;

  if (isValidTheme) return;

  throwShikiError({
    kind: "theme-not-string",
    caller,
    message: shikiErrorMessage.themeNotString(caller, which, describeArgumentType(value)),
  });
}

/**
 * Validate that `options.langs`, when present, is an array.
 *
 * @param langs Value of `options.langs`.
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginShikiArgumentError} With `langs-not-array` kind.
 */
function assertLangs(langs: unknown, caller: string): void {
  if (langs === undefined) return;
  if (Array.isArray(langs)) return;

  throwShikiError({
    kind: "langs-not-array",
    caller,
    message: shikiErrorMessage.langsNotArray(caller, describeArgumentType(langs)),
  });
}

/**
 * Validate that `options.loadTheme`, when present, is a function.
 *
 * @param loadTheme Value of `options.loadTheme`.
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginShikiArgumentError} With `load-theme-not-function` kind.
 */
function assertLoadTheme(loadTheme: unknown, caller: string): void {
  if (loadTheme === undefined) return;
  if (typeof loadTheme === "function") return;

  throwShikiError({
    kind: "load-theme-not-function",
    caller,
    message: shikiErrorMessage.loadThemeNotFunction(caller, describeArgumentType(loadTheme)),
  });
}

/**
 * Validate that `options.onUnknownLang`, when present, is one of the
 * allowed string-literal values.
 *
 * @param value Value of `options.onUnknownLang`.
 * @param caller Public function name for the error message.
 * @throws {StreamdPluginShikiArgumentError} With `on-unknown-lang-invalid` kind.
 */
function assertOnUnknownLang(value: unknown, caller: string): void {
  if (value === undefined) return;

  const isValidValue =
    typeof value === "string" && UNKNOWN_LANG_VALUES.has(value as ShikiUnknownLangBehavior);

  if (isValidValue) return;

  throwShikiError({
    kind: "on-unknown-lang-invalid",
    caller,
    message: shikiErrorMessage.onUnknownLangInvalid(caller, describeArgumentType(value)),
  });
}
