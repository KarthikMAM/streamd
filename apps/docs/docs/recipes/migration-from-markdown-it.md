---
title: Migrating from markdown-it
sidebar_position: 7
---

# Migrating from markdown-it

streamd has a different shape to [`markdown-it`](https://github.com/markdown-it/markdown-it):
the parser emits a token tree instead of raw HTML, and rendering is
a separate step handled by `@streamd/html`, `@streamd/react`, or
`@streamd/react-native`. This makes streaming and framework-agnostic
rendering first-class.

## API equivalents

| `markdown-it` | streamd | Notes |
|---|---|---|
| `new MarkdownIt(options)` | `parse` from `@streamd/parser` | No parser instance; `parse(src, state?, options?)` is pure. Pre-bind options via `createParser(options)` if you prefer. |
| `md.render(src)` | `renderHtml(parse(src).tokens)` | Two steps in streamd. |
| `md.renderInline(src)` | n/a | streamd parses documents; for inline-only input, consume `InlineToken` children yourself. |
| `md.parse(src, {})` | `parse(src).tokens` | Output shape differs (see below). |
| Built-in `html: true` | `renderHtml(..., { allowDangerousMetaHtml: true })` controls plugin-produced HTML. Raw HTML in source surfaces as `HtmlBlock` / `HtmlInline` tokens. | For untrusted input, add `sanitize()`. |
| `linkify: true` | `parse(src, state, { autolinks: true })` | Or `gfm: true`. |
| `typographer: true` | n/a | Not in streamd (yet). |
| `highlight: (str, lang) => …` | `highlightCode({ highlight })` from `@streamd/plugins`, or `@streamd/plugin-shiki` | Plugin writes pre-rendered HTML to `meta.html`. Requires `allowDangerousMetaHtml: true`. |
| Plugin ecosystem (`md.use(plugin)`) | `plugins: [...]` on the renderer, or `applyPlugins(tokens, plugins)` for a raw pipeline | streamd's plugin ABI is different — see below. |

## Token output

`markdown-it` emits a flat `Array<Token>` where each token has a
`type` string like `"paragraph_open"` / `"inline"` /
`"paragraph_close"`, a `nesting` field, and inlines nested under
`"inline"` tokens via `token.children`.

streamd's `TokensList` is a flat `Array<Token>` too, but the shape
is different:

- `token.type` is a **dense integer** (0–22), not a string. Compare
  against `TokenType.Paragraph` etc. from `@streamd/parser`.
- No `*_open` / `*_close` pairing — each block token owns its
  `children` array directly.
- Inline tokens live inside `children` on paragraph / heading /
  table cell tokens.

Minimal mapping:

```ts
// markdown-it
for (const token of md.parse(src, {})) {
  if (token.type === "inline") {
    for (const child of token.children ?? []) {
      // …
    }
  }
}

// streamd
import { parse, TokenType } from "@streamd/parser";

for (const token of parse(src).tokens) {
  if (token.type === TokenType.Paragraph) {
    for (const child of token.children) {
      // …
    }
  }
}
```

## GFM

`markdown-it` ships with plugin packages for GFM features
(`markdown-it-gfm-table`, `markdown-it-strikethrough`, etc.).
streamd has them built-in under feature flags:

```ts
parse(src, null, {
  gfm: true,            // shorthand for the four flags below
  tables: true,
  strikethrough: true,
  taskListItems: true,
  autolinks: true,
  math: true,           // $…$ inline and $$…$$ block (not in markdown-it core)
});
```

## Plugins

`markdown-it`'s plugin API hooks into the renderer's rule registry
(`md.renderer.rules.link_open = …`). streamd plugins transform the
token tree before any renderer sees it:

```ts
import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import { walk, type Plugin } from "@streamd/plugins";

export function externalLinkRels(): Plugin {
  return {
    name: "externalLinkRels",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens) {
      return walk(tokens, {
        /* visitor that rewrites Link tokens */
      });
    },
  };
}
```

Every plugin must declare the token-schema version it was built
against. See the [plugins package doc](../packages/plugins#plugin-abi).

## Caveats

- **No built-in HTML sanitiser in `markdown-it`.** streamd's
  [`sanitize()`](../packages/plugins#sanitize) is the recommended
  defence for untrusted input and must be **last** in the pipeline.
- **Streaming**. `markdown-it` is batch-only. For LLM output, the
  whole reason to switch is streamd's incremental `parse(src, state)`
  API — see the [LLM streaming recipe](./llm-streaming).
- **Typography**. streamd does not implement `markdown-it`'s
  `typographer` transformations (smart quotes, ellipsis, em/en
  dashes). Run these as a post-tokenisation plugin or a pre-parse
  text transform if you need them.
- **Render hooks.** `markdown-it`'s `renderer.rules` lets you
  customise per-token HTML. In streamd, do this via
  [component overrides](./custom-components) for React / React Native
  or by consuming the token tree yourself for plain HTML.

## Further reading

- [@streamd/parser](../packages/parser) — parser API and token
  model.
- [@streamd/html](../packages/html) — renderer options and `streamHtml`.
- [@streamd/plugins](../packages/plugins) — plugin ABI and built-ins.
- [Safe pipeline recipe](./sanitize-and-plugins) — untrusted-input
  recipe.
