---
title: "@streamd/plugin-katex"
sidebar_position: 8
---

# @streamd/plugin-katex

[KaTeX](https://katex.org/) math-rendering adapter for the
[`@streamd/plugins`](./plugins) pipeline. `MathBlock` and
`MathInline` tokens are rendered via `katex.renderToString` and the
produced HTML is stored on `token.meta.html` for downstream
renderers to splice in.

Who it's for: docs sites, LLM-response rendering, and any consumer
that surfaces math written as `$…$` / `$$…$$` in markdown.

## Install

```bash
npm install @streamd/plugin-katex @streamd/parser @streamd/plugins katex
```

KaTeX ships CSS (`katex.min.css`) and fonts that must be loaded on
any page that displays the rendered output. See the KaTeX docs for
the standard `<link>` tag / bundler recipe.

## Quick start

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { katex } from "@streamd/plugin-katex";

const katexPlugin = katex({
  throwOnError: false,
  macros: { "\\R": "\\mathbb{R}" },
});

const { tokens } = parse(markdown, null, { math: true });
const html = renderHtml(tokens, {
  plugins: [katexPlugin],
  allowDangerousMetaHtml: true,
});
```

Unlike the Shiki adapter this factory is **synchronous** — KaTeX has
no grammar or font init to await — so you can drop the plugin
straight into any pipeline.

Note: the parser must be configured with `math: true` (or
`gfm: true, math: true`) for the math tokens to appear in the first
place. See the [math rendering recipe](../recipes/math-rendering) for
the end-to-end flow.

## Security contract — `allowDangerousMetaHtml` is required

This plugin writes KaTeX's pre-rendered HTML into `token.meta.html`.
Renderers **ignore `meta.html` by default** — you must opt in with
`allowDangerousMetaHtml: true` on the renderer options for KaTeX's
output to appear in the page.

`allowDangerousMetaHtml: true` tells the renderer to splice
`meta.html` verbatim — no escaping, no validation. KaTeX's output is
safe by construction (it escapes all source characters and emits only
`<span>` and MathML elements with controlled attributes), so opting
in is appropriate here. But the same flag also trusts every other
plugin in the pipeline to produce safe HTML. Only enable it when you
control every plugin in your configured pipeline.

### Using `sanitize()` with `katex`

`sanitize()` strips `meta.html` by default. Two viable combinations:

```ts
// Trust katex explicitly — sanitize keeps the pre-rendered HTML
renderHtml(tokens, {
  plugins: [katexPlugin, sanitize({ allowRawHtml: true })],
  allowDangerousMetaHtml: true,
});

// Defence in depth — sanitize strips katex output entirely
renderHtml(tokens, {
  plugins: [katexPlugin, sanitize()],
  // allowDangerousMetaHtml left false; math renders via the renderer default
});
```

The second form falls back to the renderer's default math
emission — useful when the threat model distrusts KaTeX output
(e.g. a supply-chain concern).

## Key APIs

| Export | Purpose |
|---|---|
| `katex(options?)` | Synchronous factory. Returns a `Plugin`. |
| `KatexPluginOptions` | Options type — `throwOnError`, `displayMode`, `macros`. |
| `KatexDisplayMode` | `"auto"` \| `"always-block"` \| `"always-inline"`. |
| `StreamdPluginKatexArgumentError` | `TypeError` subclass extending the shared `StreamdArgumentError`. Carries a stable `kind` discriminator. |

### Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `throwOnError` | `boolean` | `false` | Passed straight to KaTeX. `false` renders a fallback span; `true` lets the error propagate and `applyPlugins` rewraps it as `StreamdPluginAbiError`. |
| `displayMode` | `"auto" \| "always-block" \| "always-inline"` | `"auto"` | How to pick KaTeX's display mode. Default: `MathBlock` → display, `MathInline` → inline. |
| `macros` | `Record<string, string>` | `{}` | Custom LaTeX macros. Passed straight through to `katex.renderToString`. |

### `throwOnError` behaviour

- `false` (default) — KaTeX catches its own `ParseError` and emits a
  `<span class="katex-error">` containing the raw source. Useful for
  LLM streaming where partial / malformed math is expected.
- `true` — KaTeX throws. `applyPlugins` rewraps the throw as
  `StreamdPluginAbiError` with `kind: "transform-failed"`, plugin
  name `"katex"`, and the original KaTeX error on `cause`.

### `displayMode`

- `"auto"` — `MathBlock` tokens render in display mode, `MathInline`
  inline. Matches the `$…$` vs `$$…$$` semantics most consumers
  expect.
- `"always-block"` — every math token (block or inline) renders in
  display mode.
- `"always-inline"` — every math token renders inline, even block
  tokens.

## Errors

`StreamdPluginKatexArgumentError` extends `StreamdArgumentError` from
`@streamd/tokens`.

Stable `kind` discriminators:

- `"options-not-object"`, `"throw-on-error-not-boolean"`,
  `"display-mode-invalid"`, `"macros-not-object"`,
  `"macro-value-not-string"` — factory-boundary validation.

Runtime errors from KaTeX (when `throwOnError: true`) surface as
`StreamdPluginAbiError` with `kind: "transform-failed"` — the plugin
name is on `pluginName` and the original KaTeX error is on `cause`.

## Source

- [README on GitHub](https://github.com/KarthikMAM/streamd/blob/main/packages/plugin-katex/README.md)
- [Source tree](https://github.com/KarthikMAM/streamd/tree/main/packages/plugin-katex/src)
