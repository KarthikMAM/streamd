/**
 * Streaming reveal React context and hook.
 *
 * @module streaming/context
 */
import { createContext, useContext } from "react";
import type { StreamingRevealConfig } from "./types";

/** Default streaming reveal configuration (inactive). */
const DEFAULT_CONFIG: StreamingRevealConfig = {
  isStreaming: false,
  granularity: "word",
  textMode: "source",
  animation: "fade",
};

/** React context holding the active streaming reveal configuration. */
export const StreamingRevealContext = createContext<StreamingRevealConfig>(DEFAULT_CONFIG);

/**
 * Read the active streaming reveal configuration from context.
 *
 * Returns the default (inactive) config when used outside a provider.
 *
 * @returns The current {@link StreamingRevealConfig}.
 */
export function useStreamingReveal(): StreamingRevealConfig {
  return useContext(StreamingRevealContext);
}
