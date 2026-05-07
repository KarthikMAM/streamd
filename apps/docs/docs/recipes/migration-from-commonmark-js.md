---
title: Migrating from commonmark.js
sidebar_position: 8
---

# Migrating from commonmark.js

[`commonmark.js`](https://github.com/commonmark/commonmark.js) is the
reference CommonMark parser. streamd targets the same spec (0.31.2)
and adds GFM extensions and streaming support.

## API equivalents

| `commonmark.js` | streamd | Notes |
|---|---|---|
| `new commonmark.Parser()` | `parse` from `@streamd/parser` | No parser instance; `parse(src, state?, options?)` is pure. |
| `parser.parse(src)` | `parse(src).tokens` | Shape differs — streamd emits a flat `TokensList`, not an AST with parent / child walker nodes. |
| `new commonmark.HtmlRenderer()` | `renderHtml` from `@streamd/html` | Single function; no renderer instance. |
| `renderer.render(ast)` | `renderHtml(tokens)` | — |
| `renderer.render(ast, { sourcepos: true })` | n/a | streamd does not carry source positions on tokens. |
| `{ safe: true }` | Use [`sanitize()`](../packages/plugins#sanitize) from `@streamd/plugins` | streamd's sanitize is more thorough (URL schemes, `meta.html`, `meta.attrs`). |
| `{ smart: true }` | n/a | Smart punctuation is not implemented. |
| `{ softbreak: "\n" }` / `"<br />"` | Handled via component overrides in React; the HTML renderer emits `<br />` by default for hard breaks. Soft breaks become whitespace. | Customise via `components.softbreak` / `components.hardbreak` in React / React Native. |

## AST vs token tree

`commonmark.js` returns a tree with a walker:

```js
const parser = new commonmark.Parser();
const ast = parser.parse(src);
const walker = ast.walker();
let event;
while ((event = walker.next())) {
  const { node, entering } = event;
  // node.type is "heading" / "paragraph" / "text" / …
}
```

streamd returns a flat `TokensList` — block tokens own their
inline children directly, no walker needed:

```ts
import { parse, TokenType } from "@streamd/parser";

for (const block of parse(src).tokens) {
  if (block.type === TokenType.Heading) {
    for (const inline of block.children) {
      if (inline.type === TokenType.Text) {
        // inline.content
      }
    }
  }
}
```

- `block.type` is a dense integer (0–22), not a string. Compare
  against `TokenType.*` / `BlockType.*` from `@streamd/parser`.
- Container blocks (`List`, `ListItem`, `Blockquote`) nest via
  `children`. Leaves (`CodeBlock`, `HtmlBlock`, `Hr`, `Space`) don't.

## GFM

`commonmark.js` is strict CommonMark. To get GFM (tables, strike,
task lists, autolinks), enable them in streamd:

```ts
parse(src, null, {
  gfm: true,            // tables + strike + task lists + autolinks
  math: true,           // $…$ inline and $$…$$ block (not in CommonMark)
});
```

## Raw HTML

CommonMark preserves raw HTML in the source. So does streamd — it
surfaces as `HtmlBlock` / `HtmlInline` tokens. The HTML renderer
emits them verbatim by default.

For untrusted input, always add `sanitize()`:

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { sanitize } from "@streamd/plugins";

const html = renderHtml(parse(userMarkdown).tokens, {
  plugins: [sanitize()],
});
```

`sanitize()` drops `HtmlBlock` / `HtmlInline` tokens, rewrites link
schemes against a safe allowlist, and strips plugin-produced
`meta.html` / dangerous `meta.attrs`. See the
[safe pipeline recipe](./sanitize-and-plugins) for the full decision
matrix.

## Streaming

`commonmark.js` is batch-only. The whole reason to migrate is
streamd's incremental `parse(src, state)` API:

```ts
import { parse, type ParserState } from "@streamd/parser";

let state: ParserState | null = null;
let accumulated = "";
for await (const chunk of llm) {
  accumulated += chunk;
  const result = parse(accumulated, state);
  state = result.state;
  render(result.tokens);
}
```

See the [LLM streaming recipe](./llm-streaming) for the end-to-end
wiring.

## Source positions

`commonmark.js` carries `sourcepos` on every AST node when the
renderer is configured with `{ sourcepos: true }`. streamd does not
expose source positions on its tokens — the priority is zero-cost
streaming, and position tracking adds allocation overhead.

If you need source-range tracking (e.g. for syntax-aware editor
integrations), consume the parser's output and maintain your own
mapping by reading the source around each token's content, or stick
with `commonmark.js` for that use case.

## Further reading

- [@streamd/parser](../packages/parser) — parser API, token model,
  and `TokenType` / `BlockType` constants.
- [@streamd/html](../packages/html) — renderer options.
- [Safe pipeline recipe](./sanitize-and-plugins) — untrusted-input
  pipeline.
- [LLM streaming recipe](./llm-streaming) — streaming use case.
