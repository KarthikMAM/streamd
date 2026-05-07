/**
 * Trust-boundary shape assertions for the public `@streamd/tokens` API.
 *
 * `mergeTheme` and `themeToCss` both accept values typed `Theme` or
 * `ThemeOverride`, but at runtime TypeScript's type annotations are
 * erased — a caller can pass `null`, an array, or a plain primitive
 * and crash deep inside the spread / property access. These helpers
 * catch that at the boundary and throw the structured
 * `StreamdArgumentError` that consumers already handle.
 *
 * The asserter signatures deliberately do NOT include an `asserts x is
 * Record<string, unknown>` clause: narrowing a caller's more-specific
 * compile-time type (`ThemeOverride`) down to a less-specific runtime
 * shape would strip the named fields and force index-signature
 * access in the caller. These functions only enforce the runtime
 * invariant and leave compile-time narrowing untouched.
 *
 * @module validate-input
 */

import { describeArgumentType, StreamdArgumentError } from "./errors";
import type { Theme } from "./types";

/** Source label emitted on every error thrown by this package. */
const SOURCE = "@streamd/tokens";

/** Top-level keys that a valid `Theme` object must contain. */
const THEME_REQUIRED_KEYS: ReadonlyArray<keyof Theme> = [
  "name",
  "colors",
  "spacing",
  "typography",
  "radii",
];

/**
 * True when `value` is a non-null, non-array JS object — the shape a
 * runtime theme or override must satisfy.
 *
 * @param value - Any runtime value.
 * @returns `true` for plain objects and class instances, `false` for
 *   primitives, `null`, and arrays.
 */
function isPlainObject(value: unknown): boolean {
  const isNull = value === null;
  const isObject = typeof value === "object";
  const isArray = Array.isArray(value);

  return !isNull && isObject && !isArray;
}

/**
 * Build a `StreamdArgumentError` describing an invalid argument shape.
 *
 * @param caller - Public function that rejected the argument
 *   (e.g. `"mergeTheme"`).
 * @param kind - Stable discriminator for the specific failure mode
 *   (e.g. `"invalid-base-theme"`).
 * @param message - Human-readable explanation.
 * @returns A new `StreamdArgumentError` with `source: "@streamd/tokens"`.
 */
function argumentError(caller: string, kind: string, message: string): StreamdArgumentError {
  return new StreamdArgumentError({ source: SOURCE, caller, kind, message });
}

/**
 * Assert that `value` is a `Theme` — a non-null object with every
 * top-level group key populated.
 *
 * Does not recurse into the colour / spacing / typography / radii
 * groups — field-level safety is enforced separately at emission time
 * by the `validate-css-value` predicates.
 *
 * @param value - Runtime value to check.
 * @param caller - Public function for diagnostics.
 * @param kind - Stable discriminator for the thrown error.
 * @param paramName - Name of the argument being validated
 *   (e.g. `"base"`, `"theme"`).
 * @throws {StreamdArgumentError} When `value` is not a plain object or
 *   a required key is missing.
 */
export function assertTheme(value: unknown, caller: string, kind: string, paramName: string): void {
  if (!isPlainObject(value)) {
    throw argumentError(
      caller,
      kind,
      `${caller}: expected ${paramName} to be a Theme object, received ${describeArgumentType(value)}`,
    );
  }
  const record = value as Record<string, unknown>;
  for (const key of THEME_REQUIRED_KEYS) {
    if (key in record) continue;
    throw argumentError(
      caller,
      kind,
      `${caller}: ${paramName} is missing required Theme key '${key}'`,
    );
  }
}

/**
 * Assert that `value` is a non-null, non-array object.
 *
 * Used for `ThemeOverride`, which has no required keys — the only
 * shape invariant is "is an object at all".
 *
 * @param value - Runtime value to check.
 * @param caller - Public function for diagnostics.
 * @param kind - Stable discriminator for the thrown error.
 * @param paramName - Name of the argument being validated.
 * @throws {StreamdArgumentError} When `value` is not a plain object.
 */
export function assertPlainObject(
  value: unknown,
  caller: string,
  kind: string,
  paramName: string,
): void {
  if (isPlainObject(value)) return;
  throw argumentError(
    caller,
    kind,
    `${caller}: expected ${paramName} to be an object, received ${describeArgumentType(value)}`,
  );
}
