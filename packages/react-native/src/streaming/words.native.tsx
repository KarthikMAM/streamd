/**
 * `<Words>` component for native — splits text by granularity and
 * animates each unit using React Native's core `Animated` API.
 *
 * @module streaming/words.native
 */
import { createElement, Fragment, type ReactNode, useEffect, useRef } from "react";
import { Animated } from "react-native";
import { getAnimationKeyframes } from "./animation.native";
import { useStreamingReveal } from "./context";
import type { StreamingGranularity } from "./types";
import { useShouldStream } from "./use-should-stream";

/** Props for the Words component. */
export interface WordsProps {
  /** Text content to split and reveal. */
  readonly text: string;
}

/** Animation duration in milliseconds. */
const DURATION_MS = 200;

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
 * Renders text split by granularity with per-unit reveal animation.
 *
 * When streaming is active, each unit fades/slides in using the
 * configured animation preset via RN's core Animated API.
 * When not streaming, renders plain `<Text>` with no animation overhead.
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
    elements[i] = createElement(AnimatedUnit, {
      key: i,
      text: units[i],
      animation: config.animation,
    });
  }
  return createElement(Fragment, null, ...elements);
}

/** Props for a single animated text unit. */
interface AnimatedUnitProps {
  /** The text content of this unit. */
  readonly text: string;
  /** The animation preset to apply. */
  readonly animation: string;
}

/**
 * A single animated text unit using RN Animated.Value.
 *
 * @param props - The unit text and animation preset.
 * @returns An Animated.Text element.
 */
function AnimatedUnit(props: AnimatedUnitProps): ReactNode {
  const progress = useRef(new Animated.Value(0)).current;
  const keyframes = getAnimationKeyframes(props.animation as never);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const hasOpacity = "opacity" in keyframes.initial;
  const opacity = hasOpacity
    ? progress.interpolate({
        inputRange: [0, 1],
        outputRange: [keyframes.initial["opacity"] as number, 1],
      })
    : 1;

  const style: Record<string, unknown> = { opacity };

  return createElement(Animated.Text, { style }, props.text);
}
