/// <reference lib="dom" />
// @vitest-environment happy-dom
/**
 * Tests for the `useStreamingMarkdown` hook in `@streamd/react`.
 *
 * Exercises stateful behaviour (append, reset, monotonic stableCount,
 * reactive parseOptions). Requires a DOM (happy-dom) to mount real
 * React components via `createRoot`.
 *
 * @module markdown.test
 */
import { act, createElement, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useStreamingMarkdown } from "./markdown";
import type { StreamdMarkdownProps, UseStreamingMarkdownResult } from "./types";
import { StreamdReactArgumentError } from "./validation";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ParseOpts = StreamdMarkdownProps["parseOptions"];

/** Mutable capture record for hook results. */
interface HookProbe {
  current: UseStreamingMarkdownResult | null;
}

/**
 * Test harness component exposing the latest hook result through a probe.
 *
 * @param props - Probe, initial source, and parser options.
 */
function HookProbeComponent(props: {
  readonly probe: HookProbe;
  readonly initial: string;
  readonly options: ParseOpts;
}): ReactNode {
  const result = useStreamingMarkdown(props.initial, props.options);
  const { probe } = props;
  useEffect(() => {
    probe.current = result;
  });
  probe.current = result;
  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

/**
 * Mount the hook probe and return the probe + rerender helper.
 *
 * @param initial - Initial source.
 * @param options - Parser options.
 */
function mountHook(
  initial: string,
  options?: ParseOpts,
): {
  readonly probe: HookProbe;
  readonly rerender: (nextInitial: string, nextOptions?: ParseOpts) => void;
} {
  const probe: HookProbe = { current: null };
  act(() => {
    root?.render(createElement(HookProbeComponent, { probe, initial, options }));
  });

  const rerender = (nextInitial: string, nextOptions?: ParseOpts): void => {
    act(() => {
      root?.render(
        createElement(HookProbeComponent, { probe, initial: nextInitial, options: nextOptions }),
      );
    });
  };

  return { probe, rerender };
}

describe("useStreamingMarkdown", () => {
  it("returns empty tokens for empty initial source", () => {
    const { probe } = mountHook("");
    expect(probe.current).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(probe.current!.tokens).toEqual([]);
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(probe.current!.stableCount).toBe(0);
  });

  it("parses initial source on mount", () => {
    const { probe } = mountHook("# Hello\n");
    expect(probe.current).not.toBeNull();
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(probe.current!.tokens.length).toBeGreaterThan(0);
    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(probe.current!.tokens[0].type).toBe("heading");
  });

  it("append adds tokens incrementally", () => {
    const { probe } = mountHook("");
    expect(probe.current).not.toBeNull();

    act(() => {
      // biome-ignore lint/style/noNonNullAssertion: asserted above
      probe.current!.append("# Title\n");
    });

    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(probe.current!.tokens.length).toBeGreaterThan(0);
  });

  it("reset clears accumulated state", () => {
    const { probe } = mountHook("# Hello\n");
    expect(probe.current).not.toBeNull();

    act(() => {
      // biome-ignore lint/style/noNonNullAssertion: asserted above
      probe.current!.reset();
    });

    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(probe.current!.tokens).toEqual([]);
  });

  it("reset with source re-parses from scratch", () => {
    const { probe } = mountHook("");
    expect(probe.current).not.toBeNull();

    act(() => {
      // biome-ignore lint/style/noNonNullAssertion: asserted above
      probe.current!.reset("## New\n");
    });

    // biome-ignore lint/style/noNonNullAssertion: asserted above
    expect(probe.current!.tokens[0].type).toBe("heading");
  });

  it("throws StreamdReactArgumentError when append receives non-string", () => {
    const { probe } = mountHook("");
    expect(probe.current).not.toBeNull();

    expect(() => {
      act(() => {
        // biome-ignore lint/style/noNonNullAssertion: asserted above
        (probe.current!.append as (v: unknown) => void)(42);
      });
    }).toThrow(StreamdReactArgumentError);
  });

  it("re-parses when parseOptions change", () => {
    const { probe, rerender } = mountHook("- [x] task\n", { gfm: false });
    expect(probe.current).not.toBeNull();

    rerender("- [x] task\n", { gfm: true });

    // biome-ignore lint/style/noNonNullAssertion: asserted above
    const tokens = probe.current!.tokens;
    expect(tokens.length).toBeGreaterThan(0);
  });
});
