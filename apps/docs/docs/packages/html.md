---
title: "@streamd/html"
sidebar_position: 3
---

# @streamd/html

Synchronous HTML renderer for the [`@streamd/parser`](./parser) token
tree, plus a `streamHtml` helper that wraps `parse` + `renderHtml` for
the common streaming case. Zero runtime dependencies beyond the parser
itself. Whitespace-tolerant enough to diff against the CommonMark and
GFM reference suites.

Who it's for: server-side rendering, static site generation, CLI
output, and any client that wants plain HTML rather than a React
component tree.

## Install

```bash
npm install @streamd/html @streamd/parser
```

## Quick start

### One-shot render

```ts
import { parse } from "@streamd/parser";
import { renderHtml } from "@streamd/html";

const { tokens } = parse("# hello **world**");
console.log(renderHtml(tokens));
// <h1>hello <strong>world</strong></h1>
```

### Streaming helper

```ts
import { streamHtml } from "@streamd/html";

let state = null;
let accumulated = "";

for await (const chunk of llm) {
  accumulated += chunk;
  const result = streamHtml(accumulated, state, { parse: { gfm: true } });
  state = result.state;
  dom.innerHTML = result.html;
}
```

`streamHtml` returns `{ html, tokens, stableCount, state }`. The parser
does incremental work; the renderer produces full HTML each call so it
can be dropped into any DOM mutation strategy. The
[LLM streaming recipe](../recipes/llm-streaming) covers the delta
strategy for lower-latency updates.

### Plugins

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { headingAnchors, linkAttributes, sanitize } from "@streamd/plugins";

const html = renderHtml(parse(src).tokens, {
  plugins: [headingAnchors(), linkAttributes(), sanitize()],
  classPrefix: "md",
  wrapRoot: true,
});
```

See the [safe-pipeline recipe](../recipes/sanitize-and-plugins) for
the correct ordering of `sanitize()` and the plugins that can
reintroduce raw HTML.

## Key APIs

| Export | Purpose |
|---|---|
| `renderHtml(tokens, options?)` | Synchronous renderer. Returns an HTML string. |
| `streamHtml(src, state?, options?)` | Parse + render wrapper. Returns `{ html, tokens, stableCount, state }`. |
| `renderThemeStylesheet(theme, options?)` | Emit a themed stylesheet string (CSS vars + selectors). |
| `escapeHtml`, `escapeAttr`, `normalizeUrl`, `decodeEntities` | Escape helpers, exported for plugin authors and consumers rendering fragments manually. |
| `StreamdHtmlArgumentError` | `TypeError` subclass thrown for wrong-typed inputs. Catchable via `instanceof`. |
| `RenderHtml`, `RenderHtmlOptions`, `StreamHtmlOptions`, `StreamHtmlResult`, `ThemeStylesheetOptions` | Public types. |

### `RenderHtmlOptions`

| Option | Default | Purpose |
|---|---|---|
| `xhtml` | `true` | `<br />` vs `<br>` self-close. |
| `classPrefix` | `undefined` | Add `class="${prefix}-${kind}"` to every block. |
| `wrapRoot` | `false` | Wrap output in `<div class="${prefix}-root">`. Requires `classPrefix`. |
| `omitCodeLanguageClass` | `false` | Drop `class="language-…"` from fenced code. |
| `taskListCheckboxes` | `"disabled"` | `"disabled"` → `<input disabled>`, `"none"` → literal `[ ]` / `[x]`. |
| `math` | `"span-class"` | Math rendering strategy. |
| `plugins` | `[]` | Plugin pipeline applied before render. |
| `allowDangerousMetaHtml` | `false` | Splice `meta.html` from plugins verbatim (unsafe by default). |

## Theming

```ts
import { renderThemeStylesheet } from "@streamd/html";
import { darkTheme } from "@streamd/tokens";

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>${renderThemeStylesheet(darkTheme, { classPrefix: "md" })}</style>`,
);
```

The [custom-theme recipe](../recipes/custom-theme) shows the full
`mergeTheme` + `renderThemeStylesheet` + `classPrefix` loop.

## Security notes

- By default, raw `HtmlBlock` and `HtmlInline` tokens from the source
  are emitted verbatim. For untrusted input, add
  [`sanitize()`](./plugins#sanitize) as the **last** plugin.
- `meta.html` (produced by plugins such as `@streamd/plugin-shiki` and
  `@streamd/plugin-katex`) is **ignored by default**. Opt in with
  `allowDangerousMetaHtml: true` on the renderer options. When you do
  opt in, you are trusting every plugin in the pipeline to emit safe
  HTML — see the [Shiki](../recipes/shiki-integration) and
  [KaTeX](../recipes/math-rendering) recipes for the combinations that
  work with `sanitize()`.
- `StreamdHtmlArgumentError` extends `TypeError`. `renderHtml` insists
  on `Array<Token>`; `streamHtml` insists on a `string` source.

## Source

- [README on GitHub](https://github.com/KarthikMAM/streamd/blob/main/packages/html/README.md)
- [Source tree](https://github.com/KarthikMAM/streamd/tree/main/packages/html/src)
