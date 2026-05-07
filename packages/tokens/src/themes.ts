/**
 * Built-in light and dark themes.
 *
 * Both themes share the same spacing, typography, and radii scales —
 * only colours differ. Consumers can use these as-is or pass to
 * `mergeTheme` for project-specific overrides.
 *
 * @module themes
 */

import type { Theme, ThemeRadii, ThemeSpacing, ThemeTypography } from "./types";

/** Shared spacing scale used by both light and dark themes. */
const SPACING: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Shared typographic scale used by both light and dark themes. */
const TYPOGRAPHY: ThemeTypography = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, sans-serif",
  codeFontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  fontSizeBase: 16,
  fontSizeSm: 14,
  fontSizeLg: 18,
  headingScale: [32, 26, 22, 18, 16, 14],
  lineHeight: 1.6,
  codeLineHeight: 1.45,
  weightRegular: 400,
  weightBold: 700,
};

/** Shared border-radius scale used by both light and dark themes. */
const RADII: ThemeRadii = {
  sm: 4,
  md: 8,
};

/** Default light theme. */
export const lightTheme: Theme = {
  name: "light",
  colors: {
    text: "#1f2328",
    textMuted: "#656d76",
    background: "#ffffff",
    codeBackground: "#f6f8fa",
    preBackground: "#f6f8fa",
    border: "#d0d7de",
    blockquoteAccent: "#d0d7de",
    link: "#0969da",
    linkHover: "#0550ae",
    strong: "#1f2328",
    emphasis: "#1f2328",
  },
  spacing: SPACING,
  typography: TYPOGRAPHY,
  radii: RADII,
};

/** Default dark theme. */
export const darkTheme: Theme = {
  name: "dark",
  colors: {
    text: "#e6edf3",
    textMuted: "#8b949e",
    background: "#0d1117",
    codeBackground: "#161b22",
    preBackground: "#161b22",
    border: "#30363d",
    blockquoteAccent: "#30363d",
    link: "#58a6ff",
    linkHover: "#79c0ff",
    strong: "#e6edf3",
    emphasis: "#e6edf3",
  },
  spacing: SPACING,
  typography: TYPOGRAPHY,
  radii: RADII,
};
