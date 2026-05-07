/// <reference lib="dom" />
// @vitest-environment happy-dom
/**
 * Tests for the `useStreamingMarkdown` hook in `@streamd/react-native`.
 *
 * Exercises stateful behaviour (append, reset, monotonic stableCount,
 * reactive parseOptions). Requires a DOM (happy-dom) to mount real
 * React components via `createRoot`; the inline `@vitest-environment`
 * directive above swaps vitest's default `node` env for this file only.
 *
 * @module markdown.test
 */
import type { TokensList } from "@streamd/parser";
import { act, createElement, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useStreamingMarkdown } from "./markdown";
import type { StreamdMarkdownNativeProps, UseStreamingMarkdownResult } from "./types";
import { StreamdReactNativeArgumentError } from "./validation";

// React 18+ expects this flag when test code drives act() manually.
// See https://reactjs.org/link/react-test-act-environment
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ParseOpts = StreamdMarkdownNativeProps["parseOptions"];

/**
 * Mutable capture record updated by `HookProbe` whenever the hook
 * re-evaluates. Tests read `probe.current` after mounting / acting.
 */
interface HookProbe {
  current: UseStreamingMarkdownResult | null;
}

/**
 * Test harness that renders a component exposing the latest hook
 * result through a shared mutable probe.
 *
 * @param probe Capture record to write the latest hook result into.
 * @param initial Initial source passed to the hook.
 * @param options Parser options passed to the hook (reactive).
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
 * Mount `HookProbeComponent` with a given initial source + options and
 * return both the probe (for reading results) and a re-render helper
 * that preserves the underlying hook state across prop changes.
 */
function mountHook(
  initial: string,
  options?: ParseOpts,
): {
  readonly probe: HookProbe;
  readonly rerender: (initialSource: string, nextOptions?: ParseOpts) => void;
} {
  const probe: HookProbe = { current: null };
  act(() => {
    root?.render(createElement(HookProbeComponent, { probe, initial, options }));
  });

  const rerender = (nextInitial: string, nextOptions?: ParseOpts): void => {
    act(() => {
      root?.render(
        createElement(HookProbeComponent, {
          probe,
          initial: nextInitial,
          options: nextOptions,
        }),
      );
    });
  };

  return { probe, rerender };
}

/** Convenience — throws if the probe hasn't captured a result yet. */
function readProbe(probe: HookProbe): UseStreamingMarkdownResult {
  if (!probe.current) throw new Error("HookProbe not populated");
  return probe.current;
}

describe("useStreamingMarkdown — basic behaviour (H10)", () => {
  it("starts with empty tokens when initialSource is empty", () => {
    const { probe } = mountHook("");
    const result = readProbe(probe);
    expect(result.tokens).toEqual([] as TokensList);
    expect(result.stableCount).toBe(0);
  });

  it("parses initialSource on mount", () => {
    const { probe } = mountHook("# hello\n");
    const result = readProbe(probe);
    expect(result.tokens.length).toBeGreaterThan(0);
  });

  it("append mutates source and returns a new snapshot with updated tokens", () => {
    const { probe } = mountHook("");
    const before = readProbe(probe);
    expect(before.tokens.length).toBe(0);

    act(() => {
      readProbe(probe).append("hello ");
    });
    const after1 = readProbe(probe);
    expect(after1.tokens.length).toBeGreaterThan(0);

    act(() => {
      readProbe(probe).append("world\n\nSecond para\n");
    });
    const after2 = readProbe(probe);
    expect(after2.tokens.length).toBeGreaterThan(after1.tokens.length);
  });

  it("reset clears state; subsequent parse is fresh", () => {
    const { probe } = mountHook("");
    act(() => {
      readProbe(probe).append("abc");
    });
    expect(readProbe(probe).tokens.length).toBeGreaterThan(0);

    act(() => {
      readProbe(probe).reset();
    });
    expect(readProbe(probe).tokens).toEqual([]);
    expect(readProbe(probe).stableCount).toBe(0);

    act(() => {
      readProbe(probe).append("# fresh\n");
    });
    const afterReset = readProbe(probe);
    expect(afterReset.tokens.length).toBeGreaterThan(0);
  });

  it("reset with a new source primes tokens from that source", () => {
    const { probe } = mountHook("");
    act(() => {
      readProbe(probe).reset("# from-reset\n");
    });
    expect(readProbe(probe).tokens.length).toBeGreaterThan(0);
  });

  it("stableCount monotonically advances across appends", () => {
    const { probe } = mountHook("");
    const observations: Array<number> = [];

    act(() => {
      readProbe(probe).append("para one\n\n");
    });
    observations.push(readProbe(probe).stableCount);

    act(() => {
      readProbe(probe).append("para two\n\n");
    });
    observations.push(readProbe(probe).stableCount);

    act(() => {
      readProbe(probe).append("para three\n\n");
    });
    observations.push(readProbe(probe).stableCount);

    for (let i = 1; i < observations.length; i++) {
      expect(observations[i]).toBeGreaterThanOrEqual(observations[i - 1]);
    }
    // Last observation should strictly advance once a prior block finalises.
    expect(observations[observations.length - 1]).toBeGreaterThan(0);
  });

  it("append rejects non-string chunks with StreamdReactNativeArgumentError", () => {
    const { probe } = mountHook("");
    expect(() => {
      (readProbe(probe).append as unknown as (x: unknown) => void)(42);
    }).toThrow(StreamdReactNativeArgumentError);

    try {
      (readProbe(probe).append as unknown as (x: unknown) => void)(null);
      expect.fail("expected append(null) to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(StreamdReactNativeArgumentError);
      expect((err as StreamdReactNativeArgumentError).kind).toBe("invalid-chunk");
    }
  });
});

describe("useStreamingMarkdown — parseOptions reactivity (H12)", () => {
  it("toggling parseOptions.gfm between appends parses the next chunk with the new options", () => {
    const { probe, rerender } = mountHook("", { gfm: false });
    act(() => {
      readProbe(probe).append("~~gone~~\n");
    });
    const withoutGfmTokens = readProbe(probe).tokens;
    const hasStrikeBefore = JSON.stringify(withoutGfmTokens).includes("Strikethrough");
    expect(hasStrikeBefore).toBe(false);

    // Re-render with gfm=true; hook resets parser and re-parses accumulated src.
    rerender("", { gfm: true });
    const afterToggle = readProbe(probe);
    const jsonAfter = JSON.stringify(afterToggle.tokens);
    // Strikethrough nodes use numeric type 16 in the tree; look for the
    // presence of the renamed inline marker after re-parse.
    expect(jsonAfter).toContain('"type":16');
  });

  it("re-render with identical parseOptions values does not reset parser state", () => {
    const { probe, rerender } = mountHook("", { gfm: true });
    act(() => {
      readProbe(probe).append("hello world\n\n");
    });
    const before = readProbe(probe);

    // Fresh object, same fields — signature should match, parser is kept.
    rerender("", { gfm: true });
    const after = readProbe(probe);

    expect(after.tokens.length).toBe(before.tokens.length);
    expect(after.stableCount).toBe(before.stableCount);
  });
});
