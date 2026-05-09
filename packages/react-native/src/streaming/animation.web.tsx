/**
 * Animation presets for web — uses CSS keyframes via inline styles.
 *
 * On react-native-web, inline styles with `animationName` and
 * `animationDuration` produce CSS animations without a stylesheet.
 *
 * @module streaming/animation.web
 */
import type { AnimationKeyframes, StreamingAnimationPreset } from "./types";

/**
 * Map of preset name to initial/animate keyframe pairs.
 *
 * Web uses CSS-compatible property names (camelCase for inline styles).
 */
const PRESETS: Record<StreamingAnimationPreset, AnimationKeyframes> = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  "fade-up": {
    initial: { opacity: 0, transform: "translateY(8px)" },
    animate: { opacity: 1, transform: "translateY(0)" },
  },
  "fade-down": {
    initial: { opacity: 0, transform: "translateY(-8px)" },
    animate: { opacity: 1, transform: "translateY(0)" },
  },
  "slide-in-left": {
    initial: { opacity: 0, transform: "translateX(-12px)" },
    animate: { opacity: 1, transform: "translateX(0)" },
  },
  "slide-in-right": {
    initial: { opacity: 0, transform: "translateX(12px)" },
    animate: { opacity: 1, transform: "translateX(0)" },
  },
  "slide-up": {
    initial: { transform: "translateY(16px)" },
    animate: { transform: "translateY(0)" },
  },
  "slide-down": {
    initial: { transform: "translateY(-16px)" },
    animate: { transform: "translateY(0)" },
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
    initial: { opacity: 0.4, filter: "blur(4px)" },
    animate: { opacity: 1, filter: "blur(0)" },
  },
  "blur-fade": {
    initial: { opacity: 0, filter: "blur(4px)" },
    animate: { opacity: 1, filter: "blur(0)" },
  },
  "blur-up": {
    initial: { opacity: 0, transform: "translateY(4px)", filter: "blur(2px)" },
    animate: { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
  },
  typewriter: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  shimmer: { initial: { opacity: 0.3 }, animate: { opacity: 1 } },
  ripple: {
    initial: { opacity: 0, transform: "scale(0.9)" },
    animate: { opacity: 1, transform: "scale(1)" },
  },
  none: { initial: {}, animate: {} },
};

/**
 * Returns the animation keyframes for a given preset name.
 *
 * @param preset - The animation preset name.
 * @returns Initial and animate keyframe pair.
 */
export function getAnimationKeyframes(preset: StreamingAnimationPreset): AnimationKeyframes {
  return PRESETS[preset];
}
