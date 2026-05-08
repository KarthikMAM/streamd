/**
 * Hook that determines whether a text unit should animate in.
 *
 * Returns `true` for a brief window after mount when streaming is active,
 * then settles to `false`. Used by `<Words>` to decide whether to apply
 * the reveal animation to each unit.
 *
 * @module streaming/use-should-stream
 */
import { useEffect, useState } from "react";
import { useStreamingReveal } from "./context";

/** Duration in ms that a newly-mounted word is considered "streaming". */
const STREAM_WINDOW_MS = 300;

/**
 * Returns `true` during the reveal window when streaming is active.
 *
 * @returns Whether the current unit should animate its reveal.
 */
export function useShouldStream(): boolean {
  const { isStreaming } = useStreamingReveal();
  const [shouldAnimate, setShouldAnimate] = useState(isStreaming);

  useEffect(() => {
    if (!isStreaming) {
      setShouldAnimate(false);
      return;
    }
    setShouldAnimate(true);
    const timer = setTimeout(() => setShouldAnimate(false), STREAM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [isStreaming]);

  return shouldAnimate;
}
