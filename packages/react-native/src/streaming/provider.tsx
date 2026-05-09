/**
 * Streaming reveal context provider (platform-agnostic).
 *
 * @module streaming/provider
 */
import { createElement, type ReactNode, useMemo } from "react";
import { StreamingContext } from "./context";
import type { StreamingRevealConfig } from "./types";

/** Props for the streaming reveal provider. */
export interface StreamingRevealProviderProps {
  /** Streaming configuration to provide to descendants. */
  readonly config: StreamingRevealConfig;
  /** Child elements. */
  readonly children?: ReactNode;
}

/**
 * Provides streaming reveal configuration to descendants via context.
 *
 * @param props - Provider props with config and children.
 * @returns A context provider wrapping children.
 */
export function StreamingRevealProvider(props: StreamingRevealProviderProps): ReactNode {
  const value = useMemo(() => props.config, [props.config]);
  return createElement(StreamingContext.Provider, { value }, props.children);
}
