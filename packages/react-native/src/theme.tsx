/**
 * React Native theme context.
 *
 * Unlike the web renderer, RN doesn't consume CSS variables — components
 * read style objects directly from the theme via `useStreamdTheme()`.
 *
 * @module theme
 */
import { lightTheme, type Theme } from "@streamd/tokens";
import { createContext, createElement, type ReactNode, useContext, useMemo } from "react";

/** Theme context value. */
export interface ThemeContextValue {
  /** The active design-token theme consumed by all styled components. */
  readonly theme: Theme;
}

/**
 * React context holding the active theme. Defaults to `lightTheme` when
 * no `<ThemeProvider>` is present in the ancestor tree.
 */
const ThemeContext = createContext<ThemeContextValue>({ theme: lightTheme });

/** Props for `<ThemeProvider>`. */
export interface ThemeProviderProps {
  /** Theme to provide. Defaults to `lightTheme` when omitted. */
  readonly theme?: Theme;
  /** Child elements that will have access to the provided theme. */
  readonly children?: ReactNode;
}

/**
 * Provides the active theme to descendants via React context.
 *
 * @param props - Provider props; `theme` defaults to `lightTheme` when omitted.
 * @returns A context provider wrapping `props.children`.
 */
export function ThemeProvider(props: ThemeProviderProps): ReactNode {
  const theme = props.theme ?? lightTheme;
  const contextValue = useMemo<ThemeContextValue>(() => ({ theme }), [theme]);
  return createElement(ThemeContext.Provider, { value: contextValue }, props.children);
}

/**
 * Read the active theme from context.
 *
 * Falls back to `lightTheme` when called outside a `<ThemeProvider>`.
 *
 * @returns The current {@link ThemeContextValue}.
 */
export function useStreamdTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
