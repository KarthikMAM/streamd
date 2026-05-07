---
title: Math rendering with KaTeX
sidebar_position: 6
---

# Math rendering with KaTeX

Wire [`@streamd/plugin-katex`](../packages/plugin-katex) end-to-end:
enable math parsing, synchronous factory, `allowDangerousMetaHtml`
opt-in, and safe combinations with `sanitize()`.

## Install

```bash
npm install @streamd/plugin-katex @streamd/parser @streamd/plugins katex
```

KaTeX ships CSS (`katex.min.css`) and fonts that must be loaded on
any page that displays the rendered output. Add the standard KaTeX
`<link>` tag (or bundle the CSS + fonts via your bundler's asset
pipeline).

## Enable math parsing

The parser recognises `$…$` inline and `$$…$$` block math **only**
when `math: true` is set:

```ts
import { parse } from "@streamd/parser";

const { tokens } = parse(markdown, null, { math: true });
```

Without `math: true`, `$` is just a literal dollar sign — no
`MathInline` or `MathBlock` tokens are produced, and the plugin has
nothing to transform.

## Minimal render pipeline

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
  allowDangerousMetaHtml: true, // ⚠️ required for KaTeX output to render
});
```

Unlike Shiki, `katex()` is synchronous — no await needed. Build it
once at module scope if you render frequently.

## With sanitize — trusted KaTeX output

```ts
import { sanitize } from "@streamd/plugins";

renderHtml(tokens, {
  plugins: [katexPlugin, sanitize({ allowRawHtml: true })],
  allowDangerousMetaHtml: true,
});
```

`sanitize()` default-strips `meta.html`. `allowRawHtml: true` tells
it to trust what the plugins before it produced.

## With sanitize — defence in depth

```ts
renderHtml(tokens, {
  plugins: [katexPlugin, sanitize()],
  // allowDangerousMetaHtml left false; math renders via the renderer default
});
```

Useful when the threat model distrusts KaTeX output (e.g. supply-
chain concern). The renderer's default math emission is a plain
`<span class="math">` containing the source — displayed as LaTeX
text, not typeset math.

## React

```tsx
import { StreamdMarkdown } from "@streamd/react";
import { sanitize } from "@streamd/plugins";
import { katex } from "@streamd/plugin-katex";

const katexPlugin = katex({
  throwOnError: false,
  macros: { "\\R": "\\mathbb{R}" },
});

export function MathPost({ markdown }: { markdown: string }) {
  return (
    <StreamdMarkdown
      source={markdown}
      parseOptions={{ math: true }}
      plugins={[katexPlugin, sanitize({ allowRawHtml: true })]}
      allowDangerousMetaHtml
    />
  );
}
```

Don't forget `parseOptions={{ math: true }}` — it's the gate that
produces math tokens in the first place.

## Options

### `throwOnError`

- `false` (default) — KaTeX catches its own `ParseError` and emits
  a `<span class="katex-error">` containing the raw source. This is
  the right default for LLM streaming where partial or malformed
  math is expected.
- `true` — KaTeX throws. `applyPlugins` rewraps the throw as
  `StreamdPluginAbiError` with `kind: "transform-failed"`, plugin
  name `"katex"`, and the original error on `cause`.

### `displayMode`

- `"auto"` (default) — `MathBlock` tokens render in display mode,
  `MathInline` inline. Matches the `$…$` vs `$$…$$` semantics.
- `"always-block"` — every math token renders in display mode.
- `"always-inline"` — every math token renders inline, even block
  tokens.

### `macros`

```ts
katex({
  macros: {
    "\\R": "\\mathbb{R}",
    "\\vec": "\\mathbf{#1}",
  },
});
```

Passed straight through to `katex.renderToString`. Use it for
repeated notation across your documents.

## LLM streaming

For LLM output, keep `throwOnError: false` — partial math (mid-
token, mid-environment) is the norm until the stream finishes:

```ts
katex({ throwOnError: false });
```

The error fallback is a span with the raw LaTeX; once the stream
catches up, KaTeX successfully renders it on the next parse pass.

## Pitfalls

- **Forgetting `math: true`.** The parser doesn't produce math
  tokens by default. `$…$` renders as literal dollar signs and the
  KaTeX plugin has nothing to transform.
- **Forgetting `allowDangerousMetaHtml: true`.** `meta.html` is
  ignored by default. Without the opt-in, math renders via the
  renderer default (plain LaTeX text).
- **Forgetting the KaTeX CSS.** The typeset output uses KaTeX's
  fonts; without `katex.min.css` it falls back to browser defaults
  and looks wrong.
- **Using `throwOnError: true` with untrusted input.** KaTeX treats
  `ParseError` as fatal when this is set. The `StreamdPluginAbiError`
  kind `"transform-failed"` is catchable, but the pipeline exits
  early and no tokens are rendered.

## Further reading

- [@streamd/plugin-katex](../packages/plugin-katex) — full options
  and error taxonomy.
- [@streamd/plugins](../packages/plugins#sanitize) — the sanitize
  contract.
- [Safe pipeline recipe](./sanitize-and-plugins) — decision matrix
  for `sanitize()` + `allowDangerousMetaHtml` + plugin ordering.
