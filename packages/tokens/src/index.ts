/**
 * @streamd/tokens — design tokens and themes for streamd renderers.
 *
 * Provides light / dark built-in themes, a merge helper for custom
 * overrides, and a CSS custom-property generator.
 *
 * @module index
 */

export { themeToCss } from "./css";
export type { StreamdArgumentErrorOptions } from "./errors";
export { describeArgumentType, StreamdArgumentError } from "./errors";
export { mergeTheme } from "./merge";
export { darkTheme, lightTheme } from "./themes";
export type {
  MathRenderMode,
  TaskListCheckboxMode,
  Theme,
  ThemeColors,
  ThemeOverride,
  ThemeRadii,
  ThemeSpacing,
  ThemeToCssOptions,
  ThemeTypography,
} from "./types";
