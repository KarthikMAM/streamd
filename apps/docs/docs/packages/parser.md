---
title: "@streamd/parser"
sidebar_position: 1
---

# @streamd/parser

Streaming-first CommonMark + GFM parser. Zero runtime dependencies.
Produces a **token tree (not HTML)**, so the output is framework-agnostic
and safe to re-render on every chunk.

Who it's for: anyone rendering markdown from a source that grows over
time — LLM chat responses, live document editors, collaborative tools.
The differentiator is incremental parsing: per-chunk cost is
proportional to the new content, not the accumulated document size.

## Install

```bash
npm install @streamd/parser
```

## Quick start

```ts
import { parse } from "@streamd/parser";

const { tokens, stableCount, state } = parse("# hello **world**");
```

- `tokens` — flat array of block tokens. Each inline-bearing block
  owns its own `children` array.
- `stableCount` — how many leading tokens are guaranteed not to change
  if you keep parsing. In a one-shot call it equals `tokens.length`.
- `state` — opaque `ParserState` to feed back in for streaming.

### Streaming parse

```ts
import { parse, type ParserState } from "@streamd/parser";

let state: ParserState | null = null;
let src = "";

for await (const chunk of llm) {
  src += chunk;
  const result = parse(src, state);
  state = result.state;
  render(result.tokens);
}
```

Tokens before `result.stableCount` are final. The rest is speculative
and may change when more content arrives.

### Options

```ts
parse(src, state, {
  gfm: true,           // shorthand for the four GFM flags below
  tables: true,
  strikethrough: true,
  taskListItems: true,
  autolinks: true,
  math: true,          // $…$ inline and $$…$$ block
});
```

All extensions default to `false`. Setting `gfm: true` flips the four
GFM sub-flags on unless individually overridden.

## Key APIs

| Export | Shape |
|---|---|
| `parse(src, state?, options?)` | Runs a parse and returns `{ tokens, stableCount, state }`. |
| `createParser(options?)` | Returns a reusable parser bound to the given options. |
| `ParseOptions` | `gfm` / `tables` / `strikethrough` / `taskListItems` / `autolinks` / `math` — all `boolean`. |
| `ParseResult` | `{ tokens: TokensList; stableCount: number; state: ParserState }`. |
| `ParserState` | Opaque branded type. Pass the previous `state` back in to resume streaming. |
| `TokenType` / `BlockType` | `as const` dense integer enums used as discriminants. |
| `TOKEN_SCHEMA_VERSION` | Numeric ABI version. Plugins declare the version they are built against via `requires: { tokenSchema: TOKEN_SCHEMA_VERSION }`. |
| Token types | `Blockquote`, `List`, `ListItem`, `Heading`, `Paragraph`, `CodeBlock`, `HtmlBlock`, `Hr`, `Space`, `Table`, `Text`, `Softbreak`, `Hardbreak`, `CodeSpan`, `Em`, `Strong`, `Strikethrough`, `Link`, `Image`, `HtmlInline`, `Escape`, `MathInline`, `MathBlock`. |

Discriminants are stable: `0–9` are block tokens, `10–22` are inline
tokens. Every token carries an optional `meta?: TokenMeta` field that
plugins use to annotate (`id`, `className`, `rel`, `target`, `html`,
`attrs`).

## Design and performance

The parser ships with a detailed design document at
[`.kiro/steering/parser-design.md`](https://github.com/KarthikMAM/streamd/blob/main/.kiro/steering/parser-design.md)
covering the fast-path cascade, streaming invariants, and performance
trade-offs. Reading it is a prerequisite for non-trivial changes to
the parser, but consumers do not need it to use the API.

Highlights:

- Text-append fast path for plain-text growth inside the active
  paragraph — O(K) per chunk.
- Fenced-code and math-block fast paths that only inspect the newly
  added lines.
- Full-scan fallback is confined to the active tail block.
- No regex anywhere in hot paths; dispatch via `Uint8Array` lookup
  tables and hand-written state machines.

Concrete throughput and streaming-latency benchmarks live at
[`packages/bench/baseline.json`](https://github.com/KarthikMAM/streamd/blob/main/packages/bench/baseline.json)
and are gated on CI.

## Security notes

- The parser produces tokens; it does **not** render HTML. Any HTML in
  the source surfaces as `HtmlBlock` / `HtmlInline` tokens. The
  renderer layer (`@streamd/html`, `@streamd/react`,
  `@streamd/react-native`) decides what to do with them.
- When parsing untrusted input, pair the parser with
  [`sanitize()`](./plugins#sanitize) from `@streamd/plugins` — see the
  [safe pipeline recipe](../recipes/sanitize-and-plugins) for the
  correct ordering.

## Source

- [README on GitHub](https://github.com/KarthikMAM/streamd/blob/main/packages/parser/README.md)
- [Source tree](https://github.com/KarthikMAM/streamd/tree/main/packages/parser/src)
