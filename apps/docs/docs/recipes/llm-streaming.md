---
title: LLM streaming
sidebar_position: 1
---

# LLM streaming

Render an LLM response live as tokens arrive, without re-parsing the
whole document on every chunk. This recipe covers the two most common
shapes: plain HTML output and React.

## The problem

An LLM streams markdown one token at a time. If you call a batch
parser (`commonmark.js`, `markdown-it`, `marked`, `micromark`) on the
accumulated source every time a new chunk arrives, total work is
O(n²). streamd's parser keeps streaming state so per-chunk cost is
proportional to the new content.

## The key idea

The parser returns three things from every call:

```ts
const { tokens, stableCount, state } = parse(src, state, options);
```

- `state` — opaque `ParserState`. Pass it back into the next call.
- `stableCount` — leading tokens that will never change.
- `tokens` — everything, including the speculative tail block that
  may be rewritten when more content arrives.

Feed `state` back in on every chunk. Re-render `tokens` from scratch
each time (renderers are fast enough that this is fine). For HTML,
`streamHtml` wraps parse + render.

## Plain HTML output

```ts
import { streamHtml } from "@streamd/html";

let state = null;
let accumulated = "";

const response = await fetch("/chat", { method: "POST", body });
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;

  accumulated += decoder.decode(value, { stream: true });
  const result = streamHtml(accumulated, state, { parse: { gfm: true } });
  state = result.state;

  dom.innerHTML = result.html;
}
```

`result.html` is the full HTML for the accumulated source each call.
Setting `innerHTML` is the simplest DOM mutation strategy. For lower
latency, use the [CLI's delta mode](../packages/cli#streaming-modes)
or implement the same delta strategy in application code with
`streamHtml` outputs.

## React

Use the `useStreamingMarkdown` hook — it owns the `ParserState`
internally:

```tsx
import { useEffect, useRef } from "react";
import { StreamdMarkdown, useStreamingMarkdown } from "@streamd/react";

export function StreamingAssistant({ prompt }: { prompt: string }) {
  const { tokens, append, reset } = useStreamingMarkdown("", { gfm: true });
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    reset();
    const controller = new AbortController();
    cancelRef.current = controller;

    fetch("/chat", {
      method: "POST",
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    }).then(async (res) => {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        append(decoder.decode(value, { stream: true }));
      }
    });

    return () => controller.abort();
  }, [prompt, append, reset]);

  return <StreamdMarkdown tokens={tokens} />;
}
```

`append(chunk)` extends the source and re-parses incrementally.
`<StreamdMarkdown tokens={tokens} />` re-renders the tree — React's
reconciler reuses DOM nodes where tokens didn't change, so the live
output updates smoothly.

## React Native

Same pattern — swap `@streamd/react` for `@streamd/react-native`:

```tsx
import {
  StreamdMarkdownNative,
  useStreamingMarkdown,
} from "@streamd/react-native";

const { tokens, append } = useStreamingMarkdown("", { gfm: true });
// …drive append(chunk) from your SSE / WebSocket source…
return <StreamdMarkdownNative tokens={tokens} />;
```

## Chunking tips

- **Chunks can be tiny.** Even 1-byte chunks are fine — the parser's
  text-append fast path makes plain-text growth O(K). There's no
  benefit to batching chunks in application code before calling the
  parser.
- **Chunks can split UTF-8 codepoints.** Always decode with
  `new TextDecoder()` in `{ stream: true }` mode, not `Buffer.toString`
  / `atob` on raw byte chunks. The decoder buffers continuation bytes.
- **Chunks don't need to land on token boundaries.** The parser
  tolerates chunks in the middle of a word, markdown marker, or
  fenced-code block. A closing fence arriving across two chunks is
  handled correctly.
- **Inline special characters trigger a paragraph re-parse.** A `*`
  or `[` or `` ` `` arriving mid-paragraph falls out of the
  text-append fast path and re-parses the paragraph's inlines. The
  cost is O(N_paragraph), but paragraphs in LLM output are typically
  under 1 KB, so it's imperceptible.
- **Long-lived sessions.** The parser's internal node pool grows to
  the high-water mark of inline nodes in any single call and never
  shrinks. That's fine for one response, but don't keep a single
  `state` alive across many unrelated documents — start a new state
  per response.

## Pitfalls

- **Don't pass `state = null` on every call.** That restarts the
  parse from scratch. Always thread the returned `state` back in.
- **Don't forget `gfm: true`** if you want tables / strike / task
  lists / autolinks. They're all off by default.
- **Don't enable `allowDangerousMetaHtml` for LLM input** unless the
  pipeline uses vetted plugins only (e.g. Shiki / KaTeX). The LLM
  doesn't control what ends up in `meta.html`, plugins do — but
  trusting an unreviewed plugin with `meta.html` is the same as
  `dangerouslySetInnerHTML`.

## Further reading

- [@streamd/parser](../packages/parser) — streaming parser API and
  options.
- [@streamd/html](../packages/html) — `streamHtml` and rendering
  options.
- [@streamd/react](../packages/react) — `useStreamingMarkdown`.
- [Safe pipeline recipe](./sanitize-and-plugins) — untrusted-input
  wiring for LLM output that reaches a render target you don't fully
  control.
