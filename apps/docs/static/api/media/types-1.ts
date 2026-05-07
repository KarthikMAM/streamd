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

/** Spacing scale — raw numeric values in a unit-free form. */
export interface ThemeSpacing {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
}

/** Typographic scale. */
export interface ThemeTypography {
  readonly fontFamily: string;
  readonly codeFontFamily: string;
  readonly fontSizeBase: number;
  readonly fontSizeSm: number;
  readonly fontSizeLg: number;
  readonly headingScale: ReadonlyArray<number>;
  readonly lineHeight: number;
  readonly codeLineHeight: number;
  readonly weightRegular: number;
  readonly weightBold: number;
}

/** Radius scale — used for inline code, code blocks, etc. */
export interface ThemeRadii {
  readonly sm: number;
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

/** Deep-partial of `Theme` for `mergeTheme` overrides. */
export interface ThemeOverride {
  readonly name?: string;
  readonly colors?: Partial<ThemeColors>;
  readonly spacing?: Partial<ThemeSpacing>;
  readonly typography?: Partial<ThemeTypography>;
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
