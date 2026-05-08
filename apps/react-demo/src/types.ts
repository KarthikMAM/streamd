/**
 * Named types for the react demo app. Centralises hook return shapes,
 * component prop interfaces, and domain aliases so component signatures
 * stay short and the contract between helpers and consumers is explicit.
 *
 * @module apps/react-demo/src/types
 */
import type { StreamingAnimationPreset } from "@streamd/react/streaming";

/**
 * Identifier for the built-in themes this demo can toggle between.
 * Constrained to the two bundled token sets from `@streamd/tokens`.
 */
export type ThemeName = "light" | "dark";

/**
 * Return shape for `useLiveParse`. The consumer keeps the current
 * markdown source under its own state, and updates it via `setSource`
 * — typically wired to a textarea's `onChange`.
 */
export interface UseLiveParseResult {
  /** Current markdown source. */
  readonly source: string;
  /** Replace the current source. */
  readonly setSource: (next: string) => void;
}

/**
 * Props for the {@link ThemeSelector} component. Purely presentational
 * — state lives in the caller.
 */
export interface ThemeSelectorProps {
  /** Currently selected theme name. */
  readonly theme: ThemeName;
  /** Callback invoked with the newly selected theme. */
  readonly onChange: (name: ThemeName) => void;
}

/**
 * Props for the {@link StreamingReplay} component. Receives the full
 * markdown source to replay character-by-character.
 */
export interface StreamingReplayProps {
  /** Full markdown source to replay as a simulated stream. */
  readonly source: string;
}

/**
 * Props for the animation preset selector in the streaming reveal demo.
 */
export interface PresetSelectorProps {
  /** Currently selected animation preset. */
  readonly preset: StreamingAnimationPreset;
  /** Callback invoked with the newly selected preset. */
  readonly onChange: (preset: StreamingAnimationPreset) => void;
}
