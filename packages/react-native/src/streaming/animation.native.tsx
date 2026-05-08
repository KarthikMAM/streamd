/**
 * Animation presets for native — uses React Native's core `Animated` API.
 *
 * Trade-off: core Animated is less smooth than Reanimated for complex
 * interpolations, but adds zero dependencies. Consumers wanting smoother
 * animations can override the `<Words>` component with a Reanimated-based
 * implementation.
 *
 * @module streaming/animation.native
 */
import type { AnimationKeyframes, StreamingAnimationPreset } from "./types";

/**
 * Map of preset name to initial/animate keyframe pairs.
 *
 * Native uses `opacity` and `transform` properties compatible with
 * `Animated.Value` interpolation.
 */
const PRESETS: Record<StreamingAnimationPreset, AnimationKeyframes> = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  "fade-up": { initial: { opacity: 0, translateY: 8 }, animate: { opacity: 1, translateY: 0 } },
  "fade-down": { initial: { opacity: 0, translateY: -8 }, animate: { opacity: 1, translateY: 0 } },
  "slide-in-left": {
    initial: { opacity: 0, translateX: -12 },
    animate: { opacity: 1, translateX: 0 },
  },
  "slide-in-right": {
    initial: { opacity: 0, translateX: 12 },
    animate: { opacity: 1, translateX: 0 },
  },
  "slide-up": { initial: { translateY: 16 }, animate: { translateY: 0 } },
  "slide-down": { initial: { translateY: -16 }, animate: { translateY: 0 } },
  "scale-up": { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 } },
  "scale-down": { initial: { opacity: 0, scale: 1.2 }, animate: { opacity: 1, scale: 1 } },
  blur: { initial: { opacity: 0.4 }, animate: { opacity: 1 } },
  "blur-fade": { initial: { opacity: 0 }, animate: { opacity: 1 } },
  "blur-up": { initial: { opacity: 0, translateY: 4 }, animate: { opacity: 1, translateY: 0 } },
  typewriter: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  shimmer: { initial: { opacity: 0.3 }, animate: { opacity: 1 } },
  ripple: { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 } },
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
