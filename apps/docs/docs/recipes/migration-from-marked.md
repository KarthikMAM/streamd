---
title: Migrating from marked
sidebar_position: 9
---

# Migrating from marked

[`marked`](https://marked.js.org/) is a fast, lightweight markdown
compiler that produces HTML directly. streamd splits parse and
render into separate steps, adds streaming, and replaces the "renderer
overrides" mechanism with plugin transforms and component overrides.

## API equivalents

| `marked` | streamd | Notes |
|---|---|---|
| `marked.parse(src)` or `marked(src)` | `renderHtml(parse(src).tokens)` from `@streamd/html` | Two steps in streamd. |
| `marked.parse(src, { gfm: true })` | `renderHtml(parse(src, null, { gfm: true }).tokens)` | `gfm: true` enables the four GFM flags. |
| `marked.Lexer.lex(src)` | `parse(src).tokens` | Output shape differs — see below. |
| `marked.Parser.parse(tokens)` | `renderHtml(tokens)` | — |
| `marked.use({ renderer: { link: …, image: … } })` | Component overrides in React / React Native, or token transforms via `@streamd/plugins` | streamd has no per-token renderer overrides for the plain-HTML path. If you need them, render via React and use [component overrides](./custom-components). |
| `marked.use({ extensions: [{ name, level, start, tokenizer, renderer }] })` | Custom plugin (see [plugins package doc](../packages/plugins)) | Different shape — streamd extensions plug into the parser's dispatch table, not a renderer rule set. |
| `{ breaks: true }` | n/a | CommonMark says soft breaks collapse to whitespace. streamd follows that. Hard breaks (two spaces + newline or `\`) still produce `<br />`. |
| `{ pedantic: true }` | n/a | streamd targets CommonMark 0.31.2 + GFM 0.29; there is no `pedantic` mode. |
| `{ sanitize: true }` (deprecated in `marked`) | Use [`sanitize()`](../packages/plugins#sanitize) from `@streamd/plugins` | streamd's sanitize is more thorough: URL schemes, `meta.html`, `meta.attrs`. |
| `marked.setOptions(…)` | Bind with `createParser(options)` and pass options to `renderHtml` | No global state. |

## Token output

`marked`'s `Lexer.lex(src)` returns a nested token tree where each
token has a `type` string (`"heading"`, `"paragraph"`, `"text"`, …)
and inlines live under `tokens` on each block.

streamd's `parse(src).tokens` is a flat `Array<Token>`:

- `token.type` is a dense integer (0–22), not a string. Use
  `TokenType.*` / `BlockType.*` from `@streamd/parser`.
- Container blocks (`List`, `ListItem`, `Blockquote`) nest via
  `children`.
- Block tokens with inline content (`Heading`, `Paragraph`, table
  cells) own their `children` as an `Array<InlineToken>` directly.

Minimal mapping:

```ts
// marked
const tokens = marked.lexer(src);
for (const token of tokens) {
  if (token.type === "heading") {
    // token.depth, token.text, token.tokens (inlines)
  }
}

// streamd
import { parse, TokenType } from "@streamd/parser";

for (const token of parse(src).tokens) {
  if (token.type === TokenType.Heading) {
    // token.level, token.children (inlines)
  }
}
```

## Renderer overrides

`marked.use({ renderer: { link(href, title, text) { … } } })`
returns a raw HTML string per token. streamd does not expose this
style of override for the plain-HTML path — the `renderHtml`
function is monolithic and its output is deterministic given the
tokens and options.

Two alternatives:

- **Render via React.** `<StreamdMarkdown components={…} />` gives
  per-token component overrides. See
  [custom components](./custom-components).
- **Transform tokens pre-render.** Write a plugin that rewrites
  tokens, then call `renderHtml`:

  ```ts
  import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
  import { walk, type Plugin } from "@streamd/plugins";

  export function trackedLinks(): Plugin {
    return {
      name: "trackedLinks",
      requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
      transform(tokens) {
        return walk(tokens, {
          /* visitor that modifies Link tokens' meta.attrs */
        });
      },
    };
  }
  ```

## GFM

`marked` has `gfm: true` as a parse option — same in streamd:

```ts
parse(src, null, {
  gfm: true,          // tables + strike + task lists + autolinks
  math: true,         // $…$ inline and $$…$$ block (not in marked core)
});
```

## Async rendering

`marked` has an async mode with `{ async: true }` plus `Promise`
return from `renderer` hooks. streamd's renderers are synchronous.
For async pre-rendering (syntax highlighting, math), use plugins:

- [`@streamd/plugin-shiki`](../packages/plugin-shiki) — async factory,
  once at startup. The returned plugin is synchronous. See the
  [Shiki recipe](./shiki-integration).
- [`@streamd/plugin-katex`](../packages/plugin-katex) — synchronous
  factory, synchronous transform.

## Streaming

`marked` is batch-only. streamd's incremental `parse(src, state)`
is the whole reason to migrate for LLM-output use cases:

```ts
import { streamHtml } from "@streamd/html";

let state = null;
let src = "";
for await (const chunk of llm) {
  src += chunk;
  const { html, state: next } = streamHtml(src, state, { parse: { gfm: true } });
  state = next;
  dom.innerHTML = html;
}
```

See the [LLM streaming recipe](./llm-streaming) for the full flow.

## Sanitisation

`marked`'s `sanitize` option is deprecated; the docs now point users
to DOMPurify. streamd ships its own sanitiser: the `sanitize()`
plugin in `@streamd/plugins`:

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { sanitize } from "@streamd/plugins";

const html = renderHtml(parse(src, null, { gfm: true }).tokens, {
  plugins: [sanitize()],
});
```

`sanitize()` drops raw HTML tokens, rewrites link schemes, strips
plugin-produced `meta.html` by default, and filters `meta.attrs`
against a shared allowlist. See the
[safe pipeline recipe](./sanitize-and-plugins) for the decision
matrix when combining with Shiki / KaTeX.

## Further reading

- [@streamd/parser](../packages/parser) — parser API and token model.
- [@streamd/html](../packages/html) — renderer options and
  `streamHtml`.
- [@streamd/plugins](../packages/plugins) — ABI and built-ins.
- [LLM streaming recipe](./llm-streaming) — the main reason to
  migrate.
