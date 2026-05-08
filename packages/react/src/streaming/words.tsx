"use client";

/**
 * `<Words>` component — splits text by configured granularity and renders
 * each unit as a `<span>` with staggered animation.
 *
 * Pure React; no external animation library. Animations are applied via
 * inline CSS transitions with cumulative delay per unit index.
 *
 * @module streaming/words
 */
import { type CSSProperties, createElement, Fragment, type ReactNode } from "react";
import { ANIMATION_PRESETS } from "./animation";
import { useStreamingReveal } from "./context";
import type { RevealGranularity } from "./types";

/** Stagger delay between consecutive units in milliseconds. */
const STAGGER_MS = 30;

/** Props for the Words component. */
export interface WordsProps {
  /** Text content to split and animate. */
  readonly text: string;
}

/**
 * Splits text into units based on the configured granularity.
 *
 * @param text - Source text to split.
 * @param granularity - Splitting strategy.
 * @returns Array of text units (preserving whitespace in the split).
 */
function splitByGranularity(text: string, granularity: RevealGranularity): Array<string> {
  switch (granularity) {
    case "char":
      return text.split("");
    case "word":
      return text.split(/(?<=\s)/);
    case "line":
      return text.split(/(?<=\n)/);
    case "sentence":
      return text.split(/(?<=[.!?]\s)/);
    case "chunk":
      return [text];
    default:
      return [text];
  }
}

/**
 * Renders text split by the configured granularity, with each unit
 * wrapped in a `<span>` that transitions from the preset's `initial`
 * to `animate` styles with a staggered delay.
 *
 * When streaming is inactive, renders the text as a plain string
 * (no spans, no animation overhead).
 *
 * @param props - Component props containing the text to render.
 * @returns Fragment of animated spans, or plain text when idle.
 */
export function Words(props: WordsProps): ReactNode {
  const config = useStreamingReveal();

  if (!config.isStreaming) return props.text;

  const preset = ANIMATION_PRESETS[config.animation];
  const duration = preset.duration ?? 300;
  const units = splitByGranularity(props.text, config.granularity);

  if (units.length === 0) return null;

  const children = units.map((unit, i) => {
    const style: CSSProperties = {
      ...preset.animate,
      display: "inline",
      transition: `all ${duration}ms ease`,
      transitionDelay: `${i * STAGGER_MS}ms`,
    };
    return createElement("span", { key: i, style }, unit);
  });

  return createElement(Fragment, null, ...children);
}
