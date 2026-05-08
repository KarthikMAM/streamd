/**
 * `useShouldStream` hook — auto-detects streaming activity from token
 * count changes and timing.
 *
 * Returns `true` while new tokens arrive within the active window,
 * `false` after idle. Consumers pass the result as `config.isStreaming`
 * to the `StreamingRevealProvider`.
 *
 * @module streaming/use-should-stream
 */
import type { TokensList } from "@streamd/parser";
import { useEffect, useRef, useState } from "react";

/** Idle timeout in milliseconds — streaming is considered stopped after this. */
const IDLE_TIMEOUT_MS = 800;

/**
 * Observes token count and recent-chunk timing to decide whether
 * streaming mode is active.
 *
 * @param tokens - Current token list from the parser.
 * @returns `true` while tokens are actively arriving, `false` after idle.
 */
export function useShouldStream(tokens: TokensList): boolean {
  const [isStreaming, setIsStreaming] = useState(false);
  const prevCountRef = useRef(tokens.length);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const countChanged = tokens.length !== prevCountRef.current;
    prevCountRef.current = tokens.length;

    if (!countChanged) return;

    setIsStreaming(true);

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsStreaming(false);
      timerRef.current = null;
    }, IDLE_TIMEOUT_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [tokens.length]);

  return isStreaming;
}
