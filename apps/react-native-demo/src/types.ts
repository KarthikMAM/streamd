/**
 * Named types for the react-native demo app. Centralising hook return
 * shapes and component prop interfaces here keeps component signatures
 * in `App.tsx` short and makes contracts between helpers and consumers
 * explicit.
 *
 * @module apps/react-native-demo/src/types
 */

import type { Theme } from "@streamd/tokens";
import type { ReactNode } from "react";
import type { TextStyle, ViewStyle } from "react-native";

/** Identifier for the built-in themes this demo can toggle between. */
export type ThemeName = "light" | "dark";

/**
 * Return shape for `useStreamingSource`.
 *
 * Consumers drive a replay loop by calling `start` and/or display the
 * committed text via `accumulated`. `reset` aborts any in-flight replay
 * and seeds the buffer to either the full source or an empty string
 * depending on the hook's `enabled` argument.
 */
export interface UseStreamingSourceResult {
  /** Markdown text committed so far during the current replay. */
  readonly accumulated: string;
  /** Kick off a fresh replay from the beginning. Returns when replay completes or aborts. */
  readonly start: () => Promise<void>;
  /** Abort any running replay and reseed the buffer. */
  readonly reset: () => void;
}

/**
 * Props accepted by the {@link Chrome} layout component.
 */
export interface ChromeProps {
  /** Active theme tokens used for styling. */
  readonly theme: Theme;
  /** Currently selected theme name (for button highlight). */
  readonly themeName: ThemeName;
  /** Callback invoked when the user taps a theme button. */
  readonly onThemeChange: (name: ThemeName) => void;
  /** Scrollable body content. */
  readonly children: ReactNode;
}

/**
 * Style map produced by {@link buildChromeStyles}.
 */
export interface ChromeStyles {
  readonly container: ViewStyle;
  readonly header: ViewStyle;
  readonly title: TextStyle;
  readonly themeButtons: ViewStyle;
  readonly btn: ViewStyle;
  readonly btnActive: ViewStyle;
  readonly btnText: TextStyle;
  readonly btnTextActive: TextStyle;
  readonly scroll: ViewStyle;
}

/**
 * Style map for the replay controls row in {@link AppContent}.
 */
export interface ControlsStyles {
  readonly row: ViewStyle;
  readonly cta: ViewStyle;
  readonly ctaText: TextStyle;
  readonly secondaryText: TextStyle;
}

/**
 * Style map for the {@link ErrorBoundary} fallback UI.
 */
export interface ErrorBoundaryStyles {
  readonly root: ViewStyle;
  readonly title: TextStyle;
  readonly body: TextStyle;
}

/**
 * State carried by {@link ErrorBoundary}. When `error` is non-null, the
 * fallback UI is rendered in place of the wrapped subtree.
 */
export interface ErrorBoundaryState {
  readonly error: Error | null;
}
