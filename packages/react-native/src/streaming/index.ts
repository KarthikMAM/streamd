/**
 * Streaming reveal subpath for `@streamd/react-native`.
 *
 * @module streaming/index
 */
export { useStreamingReveal } from "./context";
export type { StreamingRevealProviderProps } from "./provider";
export { StreamingRevealProvider } from "./provider";
export type {
  AnimationKeyframes,
  StreamingAnimationPreset,
  StreamingGranularity,
  StreamingRevealConfig,
  StreamingTextMode,
} from "./types";
export { useShouldStream } from "./use-should-stream";
export type { WordsProps } from "./words.native";
export { Words } from "./words.native";
