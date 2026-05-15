/**
 * Animation presets for streaming reveal.
 *
 * Each preset defines `initial` and `animate` CSS properties applied
 * to revealed text units. Animations are staggered by index using
 * cumulative delay via CSS `transition-delay`.
 *
 * @module streaming/animation
 */
import type { CSSProperties } from "react";
import type { StreamingAnimationPreset } from "./types";

/** Shape of a single animation preset definition. */
export interface AnimationPresetDef {
  /** CSS properties applied before the unit is revealed. */
  readonly initial: CSSProperties;
  /** CSS properties applied when the unit becomes visible. */
  readonly animate: CSSProperties;
  /** Transition duration in milliseconds. Default: 300. */
  readonly duration?: number;
}

/** Map of all 16 animation presets to their CSS definitions. */
export const ANIMATION_PRESETS: Record<StreamingAnimationPreset, AnimationPresetDef> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  "fade-up": {
    initial: { opacity: 0, transform: "translateY(4px)" },
    animate: { opacity: 1, transform: "translateY(0)" },
  },
  "fade-down": {
    initial: { opacity: 0, transform: "translateY(-4px)" },
    animate: { opacity: 1, transform: "translateY(0)" },
  },
  "slide-in-left": {
    initial: { opacity: 0, transform: "translateX(-8px)" },
    animate: { opacity: 1, transform: "translateX(0)" },
  },
  "slide-in-right": {
    initial: { opacity: 0, transform: "translateX(8px)" },
    animate: { opacity: 1, transform: "translateX(0)" },
  },
  "slide-up": {
    initial: { opacity: 0, transform: "translateY(8px)" },
    animate: { opacity: 1, transform: "translateY(0)" },
  },
  "slide-down": {
    initial: { opacity: 0, transform: "translateY(-8px)" },
    animate: { opacity: 1, transform: "translateY(0)" },
  },
  "scale-up": {
    initial: { opacity: 0, transform: "scale(0.8)" },
    animate: { opacity: 1, transform: "scale(1)" },
  },
  "scale-down": {
    initial: { opacity: 0, transform: "scale(1.2)" },
    animate: { opacity: 1, transform: "scale(1)" },
  },
  blur: {
    initial: { opacity: 0, filter: "blur(4px)" },
    animate: { opacity: 1, filter: "blur(0)" },
  },
  "blur-fade": {
    initial: { opacity: 0, filter: "blur(2px)" },
    animate: { opacity: 1, filter: "blur(0)" },
    duration: 400,
  },
  "blur-up": {
    initial: { opacity: 0, filter: "blur(4px)", transform: "translateY(4px)" },
    animate: { opacity: 1, filter: "blur(0)", transform: "translateY(0)" },
  },
  typewriter: {
    initial: { opacity: 0, transform: "translateX(-2px)" },
    animate: { opacity: 1, transform: "translateX(0)" },
    duration: 50,
  },
  shimmer: {
    initial: { opacity: 0.3 },
    animate: { opacity: 1 },
    duration: 600,
  },
  ripple: {
    initial: { opacity: 0, transform: "scale(0.5)" },
    animate: { opacity: 1, transform: "scale(1)" },
    duration: 350,
  },
  none: {
    initial: {},
    animate: {},
    duration: 0,
  },
};
