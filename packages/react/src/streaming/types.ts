/**
 * Types for the streaming reveal UX layer.
 *
 * @module streaming/types
 */

/** Sixteen animation presets from the LC mapping. */
export type StreamingAnimationPreset =
  | "fade"
  | "fade-up"
  | "fade-down"
  | "slide-in-left"
  | "slide-in-right"
  | "slide-up"
  | "slide-down"
  | "scale-up"
  | "scale-down"
  | "blur"
  | "blur-fade"
  | "blur-up"
  | "typewriter"
  | "shimmer"
  | "ripple"
  | "none";

/** Granularity at which text is revealed during streaming. */
export type RevealGranularity = "char" | "word" | "line" | "sentence" | "chunk";

/** Text smoothing mode for streaming output. */
export type TextMode = "smoothed" | "source" | "adaptive" | "raw";

/** Whether streaming reveal is currently active. */
export type RevealStatus = "streaming" | "idle";

/** Configuration for the streaming reveal layer. */
export interface StreamingRevealConfig {
  /** Whether streaming is currently active. */
  readonly isStreaming: boolean;
  /** Granularity at which text units are revealed. */
  readonly granularity: RevealGranularity;
  /** Text smoothing mode. */
  readonly textMode: TextMode;
  /** Animation preset to apply to revealed units. */
  readonly animation: StreamingAnimationPreset;
}
