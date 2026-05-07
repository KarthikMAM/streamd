"use client";

/**
 * React theme context.
 *
 * Wraps markdown content with a theme + CSS class prefix. Renderer
 * components read the theme via `useStreamdTheme()`.
 *
 * Naming exception: the local `contextValue` variable would normally be
 * called `themeContextValue`, but this file also passes the same object
 * to `<Context.Provider value={...}>` where `value` is React's mandated
 * prop name.
 *
 * The `"use client"` directive at the top of this module marks the
 * provider + hook as client components for Next.js app-router callers —
 * they use `React.createContext`, which is unavailable in server
 * components.
 *
 * @module theme
 */
import { lightTheme, type Theme, themeToCss } from "@streamd/tokens";
import { createContext, createElement, type ReactNode, useContext, useMemo } from "react";
import type { ThemeContextValue } from "./types";

/** Default CSS class prefix — matches the npm package scope (`streamd-*`). */
const DEFAULT_PREFIX = "streamd";

/** React context holding the active theme and class prefix. Falls back to light theme. */
const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  classPrefix: DEFAULT_PREFIX,
});

/** Props for `<ThemeProvider>`. */
export interface ThemeProviderProps {
  /** Design-token theme to provide. Defaults to `lightTheme`. */
  readonly theme?: Theme;
  /** CSS class prefix for all generated class names. Defaults to `"streamd"`. */
  readonly classPrefix?: string;
  /** Child nodes that receive the theme context. */
  readonly children: ReactNode;
  /**
   * When true, injects a `<style>` tag with CSS custom properties for the
   * active theme. Default: true.
   */
  readonly injectStylesheet?: boolean;
}

/**
 * Provides theme + classPrefix to descendants. Optionally emits a
 * `<style>` tag with the theme's CSS custom properties.
 *
 * @param props - Provider configuration — theme, prefix, children, and
 *   optional stylesheet injection toggle.
 * @returns React tree containing the context provider, optional style tag,
 *   and the caller's children.
 */
export function ThemeProvider(props: ThemeProviderProps): ReactNode {
  const theme = props.theme ?? lightTheme;
  const classPrefix = props.classPrefix ?? DEFAULT_PREFIX;
  const injectStylesheet = props.injectStylesheet !== false;

  const contextValue = useMemo<ThemeContextValue>(
    () => ({ theme, classPrefix }),
    [theme, classPrefix],
  );

  const styleTag = injectStylesheet
    ? createElement("style", {
        "data-streamd-theme": theme.name,
        dangerouslySetInnerHTML: {
          __html: themeToCss(theme, {
            prefix: classPrefix,
            selector: `.${classPrefix}-root`,
          }),
        },
      })
    : null;

  return createElement(ThemeContext.Provider, { value: contextValue }, styleTag, props.children);
}

/**
 * Read the active theme context. Falls back to light theme outside a provider.
 *
 * @returns The current {@link ThemeContextValue} from the nearest ancestor
 *   `<ThemeProvider>`, or the default (light theme + "streamd" prefix).
 */
export function useStreamdTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
