"use client";

/**
 * StreamingRevealProvider — wraps children with streaming reveal config.
 *
 * @module streaming/provider
 */
import { createElement, type ReactNode } from "react";
import { StreamingRevealContext } from "./context";
import type { StreamingRevealConfig } from "./types";

/** Props for the streaming reveal provider. */
export interface StreamingRevealProviderProps {
  /** Streaming reveal configuration to provide to descendants. */
  readonly value: StreamingRevealConfig;
  /** Child nodes that receive the streaming context. */
  readonly children?: ReactNode;
}

/**
 * Provides streaming reveal configuration to all descendant components.
 *
 * The default `Text` component reads this context to decide whether to
 * render via `<Words>` (animated reveal) or as plain text.
 *
 * @param props - Provider configuration.
 * @returns React context provider wrapping children.
 */
export function StreamingRevealProvider(props: StreamingRevealProviderProps): ReactNode {
  return createElement(StreamingRevealContext.Provider, { value: props.value }, props.children);
}
