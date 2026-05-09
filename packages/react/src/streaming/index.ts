/**
 * @streamd/react/streaming — streaming reveal UX layer.
 *
 * Provides animation presets, a context provider, the `<Words>` component,
 * and the `useShouldStream` auto-detection hook.
 *
 * @module streaming/index
 */
export { ANIMATION_PRESETS, type AnimationPresetDef } from "./animation";
export { StreamingRevealContext, useStreamingReveal } from "./context";
export { StreamingRevealProvider, type StreamingRevealProviderProps } from "./provider";
export type {
  RevealGranularity,
  RevealStatus,
  StreamingAnimationPreset,
  StreamingRevealConfig,
  TextMode,
} from "./types";
export { useShouldStream } from "./use-should-stream";
export { Words, type WordsProps } from "./words";
