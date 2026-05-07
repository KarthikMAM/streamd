/**
 * Theme override merger.
 *
 * Produces a new Theme with per-field overrides applied on top of a base.
 * The merge is shallow per top-level group (colours, spacing, etc.) —
 * unspecified fields are taken from the base.
 *
 * @module merge
 */

import type { Theme, ThemeOverride } from "./types";
import { assertPlainObject, assertTheme } from "./validate-input";

/**
 * Merge typography overrides onto a base typography section.
 *
 * @param base - Base typography from the theme.
 * @param override - Partial typography overrides, or undefined.
 * @returns Merged typography object.
 */
function mergeTypography(
  base: Theme["typography"],
  override: ThemeOverride["typography"],
): Theme["typography"] {
  return {
    ...base,
    ...(override ?? {}),
    headingScale: override?.headingScale ?? base.headingScale,
  };
}

/**
 * Merge a `ThemeOverride` on top of a base `Theme`.
 *
 * Validates both arguments at the trust boundary — a consumer passing
 * `null`, `undefined`, a primitive, or an object missing a required
 * `Theme` group receives a `StreamdArgumentError` instead of a raw
 * `TypeError` from the spread operator.
 *
 * @param base - Base theme, used for any fields not present in
 *   `override`. Must be a non-null object with every top-level
 *   `Theme` group populated.
 * @param override - Partial theme overrides. All fields optional,
 *   but `override` itself must be a non-null object.
 * @returns A new `Theme`. The base is not mutated.
 * @throws {StreamdArgumentError} With `kind: "invalid-base-theme"`
 *   when `base` is not a valid `Theme` shape.
 * @throws {StreamdArgumentError} With `kind: "invalid-override"`
 *   when `override` is not a plain object.
 */
export function mergeTheme(base: Theme, override: ThemeOverride): Theme {
  assertTheme(base, "mergeTheme", "invalid-base-theme", "base");
  assertPlainObject(override, "mergeTheme", "invalid-override", "override");
  return {
    name: override.name ?? base.name,
    colors: { ...base.colors, ...(override.colors ?? {}) },
    spacing: { ...base.spacing, ...(override.spacing ?? {}) },
    typography: mergeTypography(base.typography, override.typography),
    radii: { ...base.radii, ...(override.radii ?? {}) },
  };
}
