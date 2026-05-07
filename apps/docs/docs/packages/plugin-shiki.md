---
title: "@streamd/plugin-shiki"
sidebar_position: 7
---

# @streamd/plugin-shiki

[Shiki](https://shiki.style/) syntax-highlighter adapter for the
[`@streamd/plugins`](./plugins) pipeline. Fenced `CodeBlock` tokens
are highlighted via Shiki's bundled grammars and themes and the
rendered HTML is stored on `token.meta.html` for downstream renderers
to splice in.

Who it's for: consumers that want accurate, theme-aware syntax
highlighting for code blocks, particularly for docs sites and
LLM-response rendering.

## Install

```bash
npm install @streamd/plugin-shiki @streamd/parser @streamd/plugins shiki
```

## Quick start

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { shiki } from "@streamd/plugin-shiki";

const shikiPlugin = await shiki({
  themes: { light: "github-light", dark: "github-dark" },
  langs: ["typescript", "javascript", "bash"],
});

const { tokens } = parse(markdown);
const html = renderHtml(tokens, {
  plugins: [shikiPlugin],
  allowDangerousMetaHtml: true,
});
```

The factory is **async** because Shiki's grammar + theme init is
async. Await it once at application startup and reuse the resolved
plugin across every render.

The [Shiki integration recipe](../recipes/shiki-integration) walks
through a full end-to-end setup, including interaction with
`sanitize()`.

## Security contract — `allowDangerousMetaHtml` is required

This plugin writes Shiki's pre-rendered HTML into `token.meta.html`.
Renderers **ignore `meta.html` by default** — you must opt in with
`allowDangerousMetaHtml: true` on the renderer options for Shiki's
output to appear in the page.

`allowDangerousMetaHtml: true` tells the renderer to splice
`meta.html` verbatim — no escaping, no validation. Shiki's output is
safe by construction (it escapes every code token and only emits
`<pre>` / `<code>` / `<span>` tags), so opting in is appropriate
here. But the same flag also trusts **every other plugin in the
pipeline** to produce safe HTML. Only enable it when you control
every plugin in your configured pipeline.

### Using `sanitize()` with `shiki`

`sanitize()` strips `meta.html` by default as a fallback against
misbehaving plugins. Two viable combinations:

```ts
// Trust shiki explicitly — sanitize keeps the pre-rendered HTML
renderHtml(tokens, {
  plugins: [shikiPlugin, sanitize({ allowRawHtml: true })],
  allowDangerousMetaHtml: true,
});

// Defence in depth — sanitize strips shiki output entirely
renderHtml(tokens, {
  plugins: [shikiPlugin, sanitize()],
  // allowDangerousMetaHtml left false; code blocks render as plain <pre><code>
});
```

The second form falls back to the renderer's default code-block
emission — useful when the threat model distrusts Shiki's grammar
files (e.g. a supply-chain concern).

## Key APIs

| Export | Purpose |
|---|---|
| `shiki(options)` | Async factory. Returns a `Promise<Plugin>`. |
| `ShikiPluginOptions` | Options type — `themes`, `langs`, `loadTheme`, `onUnknownLang`, `cache`. |
| `ShikiUnknownLangBehavior` | `"ignore"` \| `"error"` \| `"plaintext"`. |
| `StreamdPluginShikiArgumentError` | `TypeError` subclass extending the shared `StreamdArgumentError`. Carries a stable `kind` discriminator. |

### Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `themes` | `{ light: string; dark: string }` | — (required) | Dual-theme configuration. Values are Shiki bundled theme names or custom names resolved through `loadTheme`. |
| `langs` | `ReadonlyArray<string>` | common set | Restrict the grammar set Shiki loads. Pin a smaller list for faster startup. |
| `loadTheme` | `(name: string) => Promise<unknown>` | — | Escape hatch for custom themes not bundled with Shiki. Called once per theme name in `themes`. |
| `onUnknownLang` | `"ignore" \| "error" \| "plaintext"` | `"plaintext"` | Behaviour for code blocks whose language is not loaded. |
| `cache` | `boolean` | `true` | Reuse highlighter instances across `shiki()` calls sharing the same `(themes, langs)`. |

### `onUnknownLang`

- `"plaintext"` (default) — highlight with Shiki's plaintext grammar.
- `"ignore"` — leave the token unchanged. The renderer emits its
  default `<pre><code>` fallback.
- `"error"` — throw `StreamdPluginShikiArgumentError` with
  `kind: "unknown-language"`. Useful in CI to catch fenced blocks
  with mistyped languages.

## Errors

`StreamdPluginShikiArgumentError` extends `StreamdArgumentError` from
`@streamd/tokens`, so any catch that already handles
`StreamdArgumentError` covers this plugin too.

Stable `kind` discriminators:

- `"missing-options"`, `"options-not-object"`, `"themes-missing"`,
  `"themes-not-object"`, `"theme-not-string"`, `"langs-not-array"`,
  `"load-theme-not-function"`, `"on-unknown-lang-invalid"` —
  factory-boundary validation.
- `"unknown-language"` — thrown at transform time when
  `onUnknownLang: "error"` is active and a code block's language is
  not loaded.

Runtime errors from Shiki surface as `StreamdPluginAbiError` with
`kind: "transform-failed"`, the plugin name on `pluginName`, and the
original Shiki error on `cause`.

## Source

- [README on GitHub](https://github.com/KarthikMAM/streamd/blob/main/packages/plugin-shiki/README.md)
- [Source tree](https://github.com/KarthikMAM/streamd/tree/main/packages/plugin-shiki/src)
