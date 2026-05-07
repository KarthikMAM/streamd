/**
 * Theme → CSS custom properties generator.
 *
 * Emits a CSS rule block with one custom property per token. Consumers
 * can paste the output into their stylesheet or inject at runtime via
 * `dangerouslySetInnerHTML`.
 *
 * Every value is validated before it is interpolated into the template
 * (see `./validate-css-value`). This prevents a user-supplied theme
 * value from escaping the rule block with a `;` / `}` and injecting
 * additional declarations — the threat is defacement / UI-redress
 * rather than XSS, but the cost of validation is near-zero so we
 * enforce it unconditionally.
 *
 * @module css
 */

import { describeArgumentType, StreamdArgumentError } from "./errors";
import type { Theme, ThemeToCssOptions } from "./types";
import {
  isSafeColor,
  isSafeFontFamily,
  isSafeLength,
  isSafeNumericString,
} from "./validate-css-value";
import { assertTheme } from "./validate-input";

/** Default CSS selector when no override is provided. */
const DEFAULT_SELECTOR = ":root";

/** Default unit appended to numeric values. */
const DEFAULT_UNIT = "px";

/** Default prefix for every emitted custom property. */
const DEFAULT_PREFIX = "streamd";

/** ASCII code for `A` — lower bound of the uppercase range. */
const ASCII_UPPER_A = 65;
/** ASCII code for `Z` — upper bound of the uppercase range. */
const ASCII_UPPER_Z = 90;
/** ASCII distance from uppercase to lowercase — `'a' - 'A' = 32`. */
const UPPER_TO_LOWER_OFFSET = 32;

/** Source label emitted on every error thrown by this module. */
const SOURCE = "@streamd/tokens";

/** Public caller label threaded into every error. */
const CALLER = "themeToCss";

/** Stable discriminator for per-field value-safety failures. */
const KIND_UNSAFE_VALUE = "unsafe-theme-value";

/**
 * Convert a `Theme` into a CSS custom-property block.
 *
 * Every emitted value is validated — colours against
 * `isSafeColor`, numeric scales against `isSafeLength`, font families
 * against `isSafeFontFamily`, and weight / line-height values
 * additionally against `isSafeNumericString`. A failure throws
 * `StreamdArgumentError` with `kind: "unsafe-theme-value"` naming
 * the offending field.
 *
 * @param theme - Source theme. Must be a fully populated `Theme`.
 *   Consumer-supplied theme values that could have arrived from
 *   local storage or a theme editor are safe to pass here — unsafe
 *   values are rejected rather than injected verbatim.
 * @param options - Selector / unit / prefix overrides. All optional.
 * @returns CSS text containing a single rule block. Non-empty.
 * @throws {StreamdArgumentError} With `kind: "invalid-theme"` when
 *   `theme` is not a valid `Theme` shape.
 * @throws {StreamdArgumentError} With `kind: "unsafe-theme-value"`
 *   when any emitted value fails its safety predicate.
 */
export function themeToCss(theme: Theme, options: ThemeToCssOptions = {}): string {
  assertTheme(theme, CALLER, "invalid-theme", "theme");
  const selector = options.selector ?? DEFAULT_SELECTOR;
  const unit = options.unit ?? DEFAULT_UNIT;
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const lines: Array<string> = [];
  collectColorLines(theme, prefix, lines);
  collectNumericLines(theme.spacing, prefix, "spacing", unit, lines);
  collectNumericLines(theme.radii, prefix, "radius", unit, lines);
  collectTypographyLines(theme, prefix, unit, lines);
  return `${selector} {\n${lines.join("\n")}\n}\n`;
}

/**
 * Emit one `--<prefix>-color-<name>: <value>;` line per colour field,
 * after validating each value via `isSafeColor`.
 *
 * @param theme - Validated source theme.
 * @param prefix - Custom-property prefix (already resolved).
 * @param lines - Output buffer, mutated in place.
 */
function collectColorLines(theme: Theme, prefix: string, lines: Array<string>): void {
  for (const entry of Object.entries(theme.colors)) {
    const name = entry[0];
    const color: unknown = entry[1];
    assertSafeColorField(name, color);
    lines.push(`  --${prefix}-color-${kebab(name)}: ${color};`);
  }
}

/**
 * Emit numeric lines for a scale (spacing or radii) with the given
 * category, after validating each value via `isSafeLength`.
 *
 * Accepts any non-null `object` so both `ThemeSpacing` and `ThemeRadii`
 * are satisfied without a type cast — earlier revisions used
 * `as ReadonlyArray<[string, number]>` on the `Object.entries` result,
 * a small type hole that is no longer needed. Runtime values coming
 * out of `Object.entries` are treated as `unknown` and routed through
 * `assertSafeLengthField`, so a caller who bypasses the static type
 * still gets a structured error instead of a corrupt `NaN` / `"x; }"`
 * token in the CSS output.
 *
 * @param scale - Spacing or radii scale.
 * @param prefix - Custom-property prefix (already resolved).
 * @param category - Property category segment (`"spacing"` or `"radius"`).
 * @param unit - Unit suffix (e.g. `"px"`).
 * @param lines - Output buffer, mutated in place.
 */
function collectNumericLines(
  scale: object,
  prefix: string,
  category: string,
  unit: string,
  lines: Array<string>,
): void {
  for (const entry of Object.entries(scale)) {
    const name = entry[0];
    const size: unknown = entry[1];
    assertSafeLengthField(`${category}.${name}`, size);
    lines.push(`  --${prefix}-${category}-${name}: ${size}${unit};`);
  }
}

/**
 * Emit typography lines including the heading scale. Validates font
 * families, length values, weights, and line heights per field.
 *
 * @param theme - Validated source theme.
 * @param prefix - Custom-property prefix (already resolved).
 * @param unit - Unit suffix for length fields.
 * @param lines - Output buffer, mutated in place.
 */
function collectTypographyLines(
  theme: Theme,
  prefix: string,
  unit: string,
  lines: Array<string>,
): void {
  const typography = theme.typography;
  emitFontFamily(prefix, "font-family", typography.fontFamily, lines);
  emitFontFamily(prefix, "code-font-family", typography.codeFontFamily, lines);
  emitLength(prefix, "font-size-base", typography.fontSizeBase, unit, lines);
  emitLength(prefix, "font-size-sm", typography.fontSizeSm, unit, lines);
  emitLength(prefix, "font-size-lg", typography.fontSizeLg, unit, lines);
  emitNumericWeight(prefix, "line-height", typography.lineHeight, lines);
  emitNumericWeight(prefix, "code-line-height", typography.codeLineHeight, lines);
  emitNumericWeight(prefix, "weight-regular", typography.weightRegular, lines);
  emitNumericWeight(prefix, "weight-bold", typography.weightBold, lines);
  emitHeadingScale(prefix, typography.headingScale, unit, lines);
}

/**
 * Validate and emit a `--<prefix>-<property>` font-family line.
 *
 * @param prefix - Custom-property prefix.
 * @param property - Property segment (e.g. `"font-family"`).
 * @param value - Font-family candidate value.
 * @param lines - Output buffer, mutated in place.
 */
function emitFontFamily(
  prefix: string,
  property: string,
  value: unknown,
  lines: Array<string>,
): void {
  assertSafeFontFamilyField(`typography.${property}`, value);
  lines.push(`  --${prefix}-${property}: ${value};`);
}

/**
 * Validate and emit a `--<prefix>-<property>: <value><unit>;` line.
 *
 * @param prefix - Custom-property prefix.
 * @param property - Property segment.
 * @param value - Numeric length candidate.
 * @param unit - Unit suffix.
 * @param lines - Output buffer, mutated in place.
 */
function emitLength(
  prefix: string,
  property: string,
  value: unknown,
  unit: string,
  lines: Array<string>,
): void {
  assertSafeLengthField(`typography.${property}`, value);
  lines.push(`  --${prefix}-${property}: ${value}${unit};`);
}

/**
 * Validate and emit a `--<prefix>-<property>: <value>;` line for a
 * unitless numeric field (weight or line-height). Value goes through
 * both the finite-number check and the plain-numeric-string check
 * to reject scientific notation or hidden non-digit characters.
 *
 * @param prefix - Custom-property prefix.
 * @param property - Property segment.
 * @param value - Weight or line-height candidate.
 * @param lines - Output buffer, mutated in place.
 */
function emitNumericWeight(
  prefix: string,
  property: string,
  value: unknown,
  lines: Array<string>,
): void {
  assertSafeWeightField(`typography.${property}`, value);
  lines.push(`  --${prefix}-${property}: ${value};`);
}

/**
 * Validate and emit one line per heading level.
 *
 * @param prefix - Custom-property prefix.
 * @param scale - Heading scale array; every entry must be a safe
 *   numeric length.
 * @param unit - Unit suffix.
 * @param lines - Output buffer, mutated in place.
 * @throws {StreamdArgumentError} When `scale` is not an array or any
 *   entry fails `isSafeLength`.
 */
function emitHeadingScale(
  prefix: string,
  scale: unknown,
  unit: string,
  lines: Array<string>,
): void {
  if (!Array.isArray(scale)) {
    throw unsafeValueError(
      "typography.headingScale",
      `expected Array, received ${describeArgumentType(scale)}`,
    );
  }
  for (let index = 0; index < scale.length; index++) {
    const size: unknown = scale[index];
    assertSafeLengthField(`typography.headingScale[${index}]`, size);
    lines.push(`  --${prefix}-heading-${index + 1}: ${size}${unit};`);
  }
}

/**
 * Assert that `color` is a safe CSS colour string.
 *
 * @param field - Dotted path under `theme.colors` for diagnostics.
 * @param color - Candidate colour value.
 * @throws {StreamdArgumentError} When `color` is not a string or fails
 *   `isSafeColor`.
 */
function assertSafeColorField(field: string, color: unknown): asserts color is string {
  if (typeof color !== "string") {
    throw unsafeValueError(`colors.${field}`, describeArgumentType(color));
  }
  if (!isSafeColor(color)) {
    throw unsafeValueError(`colors.${field}`, formatRejectedValue(color));
  }
}

/**
 * Assert that `value` is a safe finite numeric length.
 *
 * @param path - Dotted path under `theme` for diagnostics.
 * @param value - Candidate numeric length.
 * @throws {StreamdArgumentError} When `value` is not a number or fails
 *   `isSafeLength`.
 */
function assertSafeLengthField(path: string, value: unknown): asserts value is number {
  if (typeof value !== "number") {
    throw unsafeValueError(path, describeArgumentType(value));
  }
  if (!isSafeLength(value)) {
    throw unsafeValueError(path, formatRejectedValue(value));
  }
}

/**
 * Assert that `value` is a safe font-family string.
 *
 * @param path - Dotted path under `theme` for diagnostics.
 * @param value - Candidate font-family string.
 * @throws {StreamdArgumentError} When `value` is not a string or fails
 *   `isSafeFontFamily`.
 */
function assertSafeFontFamilyField(path: string, value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw unsafeValueError(path, describeArgumentType(value));
  }
  if (!isSafeFontFamily(value)) {
    throw unsafeValueError(path, formatRejectedValue(value));
  }
}

/**
 * Assert that `value` is a safe unitless numeric token (weight or
 * line-height). Runs both the finite-number check and the plain
 * numeric-string check against `String(value)`.
 *
 * @param path - Dotted path under `theme` for diagnostics.
 * @param value - Candidate weight or line-height.
 * @throws {StreamdArgumentError} When `value` fails either check.
 */
function assertSafeWeightField(path: string, value: unknown): asserts value is number {
  if (typeof value !== "number") {
    throw unsafeValueError(path, describeArgumentType(value));
  }
  if (!isSafeLength(value)) {
    throw unsafeValueError(path, formatRejectedValue(value));
  }
  if (!isSafeNumericString(String(value))) {
    throw unsafeValueError(path, formatRejectedValue(value));
  }
}

/**
 * Format a rejected value for inclusion in an error message. Strings
 * are JSON-escaped so injection attempts remain visible without
 * polluting the surrounding message. Other types fall back to
 * `String(value)`.
 *
 * @param value - The rejected runtime value.
 * @returns A safe, reader-friendly string form.
 */
function formatRejectedValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

/**
 * Build a `StreamdArgumentError` describing an unsafe field value.
 *
 * @param path - Dotted path under `theme` identifying the field.
 * @param detail - Short description of why the value failed.
 * @returns A new `StreamdArgumentError` ready to throw.
 */
function unsafeValueError(path: string, detail: string): StreamdArgumentError {
  return new StreamdArgumentError({
    source: SOURCE,
    caller: CALLER,
    kind: KIND_UNSAFE_VALUE,
    message: `themeToCss: theme.${path} is not a safe CSS value (${detail})`,
  });
}

/**
 * Convert a camelCase identifier to kebab-case.
 *
 * @param name - Identifier such as `codeBackground`. Empty string yields `""`.
 * @returns Kebab-case equivalent, e.g. `code-background`.
 */
function kebab(name: string): string {
  if (name.length === 0) return "";
  const parts: Array<string> = [];
  for (let i = 0; i < name.length; i++) {
    parts.push(kebabChar(name, i));
  }
  return parts.join("");
}

/**
 * Kebab-case transform for a single character at `index`.
 *
 * @param name - Source identifier.
 * @param index - Character index in `name`.
 * @returns Either the original character, a lowercased ASCII letter,
 *   or `-<lowercase>` when the character is an uppercase ASCII letter
 *   past position 0.
 */
function kebabChar(name: string, index: number): string {
  const code = name.charCodeAt(index);
  const isUppercase = code >= ASCII_UPPER_A && code <= ASCII_UPPER_Z;

  if (!isUppercase) return name.charAt(index);

  const lower = String.fromCharCode(code + UPPER_TO_LOWER_OFFSET);
  return index > 0 ? `-${lower}` : lower;
}
