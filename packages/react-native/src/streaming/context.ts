/**
 * Streaming reveal context and hook.
 *
 * @module streaming/context
 */
import { createContext, useContext } from "react";
import type { StreamingRevealConfig } from "./types";

/** Default streaming config — streaming disabled, word granularity, no animation. */
const DEFAULT_CONFIG: StreamingRevealConfig = {
  isStreaming: false,
  granularity: "word",
  textMode: "source",
  animation: "none",
};

/**
 * React context holding the active streaming reveal configuration.
 * Defaults to streaming-off when no provider is present.
 */
export const StreamingContext = createContext<StreamingRevealConfig>(DEFAULT_CONFIG);

/**
 * Read the active streaming reveal configuration from context.
 *
 * @returns The current {@link StreamingRevealConfig}.
 */
export function useStreamingReveal(): StreamingRevealConfig {
  return useContext(StreamingContext);
}
