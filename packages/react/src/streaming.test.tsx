/// <reference lib="dom" />
// @vitest-environment happy-dom
/**
 * Tests for the streaming reveal subpath.
 *
 * Covers `<Words>` rendering, `useShouldStream` auto-detection,
 * and animation preset application.
 *
 * @module streaming/streaming.test
 */
import type { TokensList } from "@streamd/parser";
import { act, createElement, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamingRevealProvider } from "./streaming/provider";
import type { StreamingRevealConfig } from "./streaming/types";
import { useShouldStream } from "./streaming/use-should-stream";
import { Words } from "./streaming/words";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Words — rendering", () => {
  it("renders plain text when streaming is inactive", () => {
    const config: StreamingRevealConfig = {
      isStreaming: false,
      granularity: "word",
      textMode: "source",
      animation: "fade",
    };
    const html = renderToStaticMarkup(
      createElement(
        StreamingRevealProvider,
        { value: config },
        createElement(Words, { text: "hello world" }),
      ) as ReactNode,
    );
    expect(html).toBe("hello world");
  });

  it("renders one span per word when streaming with word granularity", () => {
    const config: StreamingRevealConfig = {
      isStreaming: true,
      granularity: "word",
      textMode: "source",
      animation: "fade",
    };
    const html = renderToStaticMarkup(
      createElement(
        StreamingRevealProvider,
        { value: config },
        createElement(Words, { text: "hello world" }),
      ) as ReactNode,
    );
    expect(html).toContain("<span");
    const spanCount = (html.match(/<span/g) ?? []).length;
    expect(spanCount).toBe(2);
  });

  it("applies fade animation inline style with opacity", () => {
    const config: StreamingRevealConfig = {
      isStreaming: true,
      granularity: "word",
      textMode: "source",
      animation: "fade",
    };
    const html = renderToStaticMarkup(
      createElement(
        StreamingRevealProvider,
        { value: config },
        createElement(Words, { text: "hi there" }),
      ) as ReactNode,
    );
    expect(html).toContain("opacity:1");
    expect(html).toContain("transition:all 300ms ease");
  });

  it("applies staggered delay per word index", () => {
    const config: StreamingRevealConfig = {
      isStreaming: true,
      granularity: "word",
      textMode: "source",
      animation: "fade",
    };
    const html = renderToStaticMarkup(
      createElement(
        StreamingRevealProvider,
        { value: config },
        createElement(Words, { text: "a b c" }),
      ) as ReactNode,
    );
    expect(html).toContain("transition-delay:0ms");
    expect(html).toContain("transition-delay:30ms");
    expect(html).toContain("transition-delay:60ms");
  });

  it("renders one span per character with char granularity", () => {
    const config: StreamingRevealConfig = {
      isStreaming: true,
      granularity: "char",
      textMode: "source",
      animation: "none",
    };
    const html = renderToStaticMarkup(
      createElement(
        StreamingRevealProvider,
        { value: config },
        createElement(Words, { text: "abc" }),
      ) as ReactNode,
    );
    const spanCount = (html.match(/<span/g) ?? []).length;
    expect(spanCount).toBe(3);
  });
});

describe("useShouldStream", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.useRealTimers();
  });

  it("returns true while new tokens arrive within the active window", () => {
    const probe = { current: false };

    function Probe({ tokens }: { tokens: TokensList }): ReactNode {
      const streaming = useShouldStream(tokens);
      useEffect(() => {
        probe.current = streaming;
      });
      probe.current = streaming;
      return null;
    }

    act(() => {
      root?.render(createElement(Probe, { tokens: [] }));
    });
    expect(probe.current).toBe(false);

    act(() => {
      root?.render(createElement(Probe, { tokens: [{ type: "paragraph", children: [] }] }));
    });
    expect(probe.current).toBe(true);
  });

  it("returns false after idle timeout", () => {
    const probe = { current: false };

    function Probe({ tokens }: { tokens: TokensList }): ReactNode {
      const streaming = useShouldStream(tokens);
      useEffect(() => {
        probe.current = streaming;
      });
      probe.current = streaming;
      return null;
    }

    act(() => {
      root?.render(createElement(Probe, { tokens: [] }));
    });

    act(() => {
      root?.render(createElement(Probe, { tokens: [{ type: "paragraph", children: [] }] }));
    });
    expect(probe.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(probe.current).toBe(false);
  });
});
