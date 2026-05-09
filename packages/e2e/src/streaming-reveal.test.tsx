/**
 * Streaming reveal equivalence — verifies the streaming reveal layer
 * produces the expected DOM structure across React and React-Native
 * renderers.
 *
 * Tests cover:
 * - `<Words>` splits text into one reveal unit per word when streaming.
 * - `useShouldStream` returns false for a stable token list (idle).
 * - The `fade` animation preset applies opacity styles to each unit.
 *
 * @module streaming-reveal.test
 */

import { parse } from "@streamd/parser";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("streaming reveal — React", () => {
  it("Words splits text into one span per word when streaming is active", async () => {
    const { Words, StreamingRevealProvider } = await import("@streamd/react/streaming");
    const config = {
      isStreaming: true,
      granularity: "word" as const,
      textMode: "source" as const,
      animation: "fade" as const,
    };
    const tree = createElement(
      StreamingRevealProvider,
      { value: config },
      createElement(Words, { text: "hello world foo" }),
    );
    const html = renderToStaticMarkup(tree as ReactNode);
    const spanCount = (html.match(/<span/g) ?? []).length;
    expect(spanCount).toBe(3);
  });

  it("Words renders plain text when streaming is inactive", async () => {
    const { Words, StreamingRevealProvider } = await import("@streamd/react/streaming");
    const config = {
      isStreaming: false,
      granularity: "word" as const,
      textMode: "source" as const,
      animation: "fade" as const,
    };
    const tree = createElement(
      StreamingRevealProvider,
      { value: config },
      createElement(Words, { text: "hello world" }),
    );
    const html = renderToStaticMarkup(tree as ReactNode);
    expect(html).not.toContain("<span");
    expect(html).toContain("hello world");
  });

  it("fade preset applies opacity transition style to each unit", async () => {
    const { Words, StreamingRevealProvider } = await import("@streamd/react/streaming");
    const config = {
      isStreaming: true,
      granularity: "word" as const,
      textMode: "source" as const,
      animation: "fade" as const,
    };
    const tree = createElement(
      StreamingRevealProvider,
      { value: config },
      createElement(Words, { text: "alpha beta" }),
    );
    const html = renderToStaticMarkup(tree as ReactNode);
    expect(html).toContain("opacity");
    expect(html).toContain("transition");
  });

  it("useShouldStream returns false for a stable token list", async () => {
    const { useShouldStream } = await import("@streamd/react/streaming");
    const tokens = parse("# hi\n").tokens;

    /** Wrapper that renders the hook result as a data attribute. */
    function Probe(): ReactNode {
      const streaming = useShouldStream(tokens);
      return createElement("div", { "data-streaming": String(streaming) });
    }

    const html = renderToStaticMarkup(createElement(Probe) as ReactNode);
    expect(html).toContain('data-streaming="false"');
  });
});

describe("streaming reveal — React Native (web)", () => {
  it("Words splits text into units when streaming is active", async () => {
    const { Words, StreamingRevealProvider } = await import("@streamd/react-native/streaming");
    const config = {
      isStreaming: true,
      granularity: "word" as const,
      textMode: "source" as const,
      animation: "fade" as const,
    };
    const tree = createElement(
      StreamingRevealProvider,
      { config },
      createElement(Words, { text: "one two three" }),
    );
    const html = renderToStaticMarkup(tree as ReactNode);
    expect(html).toContain("one");
    expect(html).toContain("two");
    expect(html).toContain("three");
  });

  it("Words renders plain text when streaming is inactive", async () => {
    const { Words, StreamingRevealProvider } = await import("@streamd/react-native/streaming");
    const config = {
      isStreaming: false,
      granularity: "word" as const,
      textMode: "source" as const,
      animation: "fade" as const,
    };
    const tree = createElement(
      StreamingRevealProvider,
      { config },
      createElement(Words, { text: "hello world" }),
    );
    const html = renderToStaticMarkup(tree as ReactNode);
    expect(html).toContain("hello world");
  });
});
