/**
 * Design-token type definitions.
 *
 * Themes are plain objects with nested records of CSS values. A renderer
 * consumes these either as CSS custom properties (via `themeToCss`) or
 * directly as style values (for React Native).
 *
 * @module types
 */

/** Color values — any valid CSS color string. */
export interface ThemeColors {
  /** Default foreground text colour. */
  readonly text: string;
  /** Muted/secondary text (e.g. list markers, captions). */
  readonly textMuted: string;
  /** Default background. */
  readonly background: string;
  /** Inline code background. */
  readonly codeBackground: string;
  /** Fenced code block background. */
  readonly preBackground: string;
  /** Border colour for table cells, hr, blockquote bar. */
  readonly border: string;
  /** Blockquote left-rail accent colour. */
  readonly blockquoteAccent: string;
  /** Link colour. */
  readonly link: string;
  /** Link hover / focus colour. */
  readonly linkHover: string;
  /** Strong emphasis colour (defaults to `text` but overridable). */
  readonly strong: string;
  /** Emphasis colour. */
  readonly emphasis: string;
}

/**
 * Spacing scale — raw numeric values in a unit-free form.
 *
 * Values are unitless; the renderer appends the configured unit
 * (default `"px"`) when emitting CSS custom properties.
 */
export interface ThemeSpacing {
  /** Extra-small spacing (4). */
  readonly xs: number;
  /** Small spacing (8). */
  readonly sm: number;
  /** Medium / base spacing (16). */
  readonly md: number;
  /** Large spacing (24). */
  readonly lg: number;
  /** Extra-large spacing (32). */
  readonly xl: number;
}

/**
 * Typographic scale.
 *
 * Numeric values are unitless — the renderer appends the configured
 * unit when emitting CSS custom properties.
 */
export interface ThemeTypography {
  /** Primary body font stack. */
  readonly fontFamily: string;
  /** Monospace font stack for code blocks and inline code. */
  readonly codeFontFamily: string;
  /** Base font size (16). */
  readonly fontSizeBase: number;
  /** Small font size (14). */
  readonly fontSizeSm: number;
  /** Large font size (18). */
  readonly fontSizeLg: number;
  /** Font sizes for h1–h6, indexed 0–5. */
  readonly headingScale: ReadonlyArray<number>;
  /** Body line-height multiplier (1.6). */
  readonly lineHeight: number;
  /** Code block line-height multiplier (1.45). */
  readonly codeLineHeight: number;
  /** Regular font weight (400). */
  readonly weightRegular: number;
  /** Bold font weight (700). */
  readonly weightBold: number;
}

/**
 * Radius scale — used for inline code, code blocks, etc.
 *
 * Values are unitless; the renderer appends the configured unit.
 */
export interface ThemeRadii {
  /** Small radius (4). */
  readonly sm: number;
  /** Medium radius (8). */
  readonly md: number;
}

/** Complete theme object. */
export interface Theme {
  readonly name: string;
  readonly colors: ThemeColors;
  readonly spacing: ThemeSpacing;
  readonly typography: ThemeTypography;
  readonly radii: ThemeRadii;
}

/**
 * Deep-partial of `Theme` for `mergeTheme` overrides.
 *
 * Every field is optional — unspecified fields are taken from the base
 * theme during merge.
 */
export interface ThemeOverride {
  /** Override the theme name. */
  readonly name?: string;
  /** Partial colour overrides. */
  readonly colors?: Partial<ThemeColors>;
  /** Partial spacing overrides. */
  readonly spacing?: Partial<ThemeSpacing>;
  /** Partial typography overrides. */
  readonly typography?: Partial<ThemeTypography>;
  /** Partial radii overrides. */
  readonly radii?: Partial<ThemeRadii>;
}

/** Options controlling CSS custom property output. */
export interface ThemeToCssOptions {
  /** Selector to scope variables under. Default: ":root". */
  readonly selector?: string;
  /** Unit appended to numeric spacing / radius values. Default: "px". */
  readonly unit?: string;
  /** Prefix applied to every variable name. Default: "streamd". */
  readonly prefix?: string;
}

/**
 * How to render GFM task-list checkboxes.
 * - "disabled": render as disabled HTML checkboxes (default).
 * - "none": do not render checkboxes at all.
 */
export type TaskListCheckboxMode = "disabled" | "none";

/**
 * How to render math tokens (MathInline, MathBlock).
 * - "span-class": wrap in a span/div with a class for external rendering (default).
 * - "tex-delim": wrap in TeX delimiters ($..$ / $$..$$).
 * - "none": render as plain text.
 */
export type MathRenderMode = "span-class" | "tex-delim" | "none";
