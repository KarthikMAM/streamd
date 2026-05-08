/**
 * Minimal `react-native` stub used by Node-side vitest runs.
 *
 * Implements only the primitives (`View`, `Text`, `Image`, `Pressable`,
 * `StyleSheet`, `Animated`) and shapes that the `@streamd/react-native`
 * renderer and its tests actually need.
 *
 * @module react-native-stub
 */
import { type ComponentType, createElement, forwardRef, type ReactNode } from "react";

/**
 * Creates a stub React component that renders a named DOM element.
 *
 * @param displayName - The element tag name used in rendered output.
 * @returns A forwarded-ref component suitable for test assertions.
 */
function makeComponent(displayName: string): ComponentType<{ readonly children?: ReactNode }> {
  const C = forwardRef<unknown, { readonly children?: ReactNode }>((props, ref) =>
    createElement(displayName, { ref, ...props }, (props as { children?: ReactNode }).children),
  );
  C.displayName = displayName;
  return C as ComponentType<{ readonly children?: ReactNode }>;
}

/** Stub `View` component — renders as `<rn-view>`. */
export const View = makeComponent("rn-view");

/** Stub `Text` component — renders as `<rn-text>`. */
export const Text = makeComponent("rn-text");

/** Stub `Image` component — renders as `<rn-image>`. */
export const Image = makeComponent("rn-image");

/** Stub `Pressable` component — renders as `<rn-pressable>`. */
export const Pressable = makeComponent("rn-pressable");

/** Stub `ScrollView` component — renders as `<rn-scrollview>`. */
export const ScrollView = makeComponent("rn-scrollview");

/** Minimal StyleSheet.create — identity pass-through for tests. */
export const StyleSheet = {
  create<T extends Record<string, unknown>>(styles: T): T {
    return styles;
  },
  flatten<T>(style: T): T {
    return style;
  },
  hairlineWidth: 1,
  absoluteFillObject: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
};

/** Minimal Platform stub — defaults to `"node"` OS. */
export const Platform = {
  OS: "node",
  select<T>(specifics: { default?: T; web?: T; ios?: T; android?: T }): T | undefined {
    return specifics.default;
  },
};

/** Stub Animated.Value — tracks a numeric value for interpolation. */
class AnimatedValue {
  public value: number;
  constructor(initial: number) {
    this.value = initial;
  }
  /** Stub interpolation — returns the output end value. */
  interpolate(config: { inputRange: Array<number>; outputRange: Array<number> }): number {
    return config.outputRange[config.outputRange.length - 1];
  }
}

/** Minimal Animated API stub for tests. */
export const Animated = {
  Value: AnimatedValue,
  Text: makeComponent("rn-animated-text"),
  View: makeComponent("rn-animated-view"),
  timing: (_value: AnimatedValue, _config: Record<string, unknown>) => ({
    start: (_cb?: () => void) => {
      if (_cb) _cb();
    },
  }),
  spring: (_value: AnimatedValue, _config: Record<string, unknown>) => ({
    start: (_cb?: () => void) => {
      if (_cb) _cb();
    },
  }),
};
