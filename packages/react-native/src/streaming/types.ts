/**
 * Streaming reveal types for `@streamd/react-native/streaming`.
 *
 * @module streaming/types
 */

/** Granularity at which text is revealed during streaming. */
export type StreamingGranularity = "char" | "word" | "line" | "sentence" | "chunk";

/** Text smoothing mode for streaming output. */
export type StreamingTextMode = "smoothed" | "source" | "adaptive" | "raw";

/** Animation preset name — one of sixteen built-in reveal animations. */
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

/** Full streaming reveal configuration. */
export interface StreamingRevealConfig {
  /** Whether the content is currently streaming. */
  readonly isStreaming: boolean;
  /** Granularity at which text is split for reveal. */
  readonly granularity: StreamingGranularity;
  /** Text smoothing mode. */
  readonly textMode: StreamingTextMode;
  /** Animation preset applied to each revealed unit. */
  readonly animation: StreamingAnimationPreset;
}

/** Initial + animate keyframe pair for an animation preset. */
export interface AnimationKeyframes {
  /** Style applied before the element is revealed. */
  readonly initial: Readonly<Record<string, unknown>>;
  /** Style animated to when the element is revealed. */
  readonly animate: Readonly<Record<string, unknown>>;
}
