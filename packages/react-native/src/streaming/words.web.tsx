/**
 * `<Words>` component for web — splits text by granularity and
 * animates each unit using CSS transitions via inline styles.
 *
 * @module streaming/words.web
 */
import { createElement, Fragment, type ReactNode, useEffect, useState } from "react";
import { Text } from "react-native";
import { getAnimationKeyframes } from "./animation.web";
import { useStreamingReveal } from "./context";
import type { StreamingGranularity } from "./types";
import { useShouldStream } from "./use-should-stream";

/** Props for the Words component. */
export interface WordsProps {
  /** Text content to split and reveal. */
  readonly text: string;
}

/**
 * Splits text into units based on the configured granularity.
 *
 * @param text - The text to split.
 * @param granularity - The splitting granularity.
 * @returns Array of text units.
 */
function splitText(text: string, granularity: StreamingGranularity): Array<string> {
  switch (granularity) {
    case "char":
      return text.split("");
    case "word":
      return text.split(/(\s+)/).filter((s) => s.length > 0);
    case "line":
      return text.split(/(\n)/).filter((s) => s.length > 0);
    case "sentence":
      return text.split(/([.!?]+\s*)/).filter((s) => s.length > 0);
    case "chunk":
      return [text];
    default:
      return [text];
  }
}

/**
 * Renders text split by granularity with per-unit CSS transition animation.
 *
 * When streaming is active, each unit transitions from initial to animate
 * styles. When not streaming, renders plain text.
 *
 * @param props - Words props containing the text to render.
 * @returns React nodes — one `<Text>` per unit when streaming, plain text otherwise.
 */
export function Words(props: WordsProps): ReactNode {
  const config = useStreamingReveal();
  const shouldAnimate = useShouldStream();

  if (!shouldAnimate || config.animation === "none") {
    return props.text;
  }

  const units = splitText(props.text, config.granularity);
  const elements = new Array<ReactNode>(units.length);
  for (let i = 0; i < units.length; i++) {
    elements[i] = createElement(WebAnimatedUnit, {
      key: i,
      text: units[i],
      animation: config.animation,
    });
  }
  return createElement(Fragment, null, ...elements);
}

/** Props for a single web-animated text unit. */
interface WebAnimatedUnitProps {
  /** The text content of this unit. */
  readonly text: string;
  /** The animation preset to apply. */
  readonly animation: string;
}

/**
 * A single animated text unit using CSS transitions.
 *
 * @param props - The unit text and animation preset.
 * @returns A Text element with transition styles.
 */
function WebAnimatedUnit(props: WebAnimatedUnitProps): ReactNode {
  const [revealed, setRevealed] = useState(false);
  const keyframes = getAnimationKeyframes(props.animation as never);

  useEffect(() => {
    requestAnimationFrame(() => setRevealed(true));
  }, []);

  const style = revealed ? keyframes.animate : keyframes.initial;

  return createElement(Text, { style: style as Record<string, unknown> }, props.text);
}
