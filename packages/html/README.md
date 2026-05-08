# @streamd/html

HTML renderer for `@streamd/parser` token trees. Zero-dependency,
synchronous, whitespace-tolerant output suitable for comparison against
CommonMark and GFM reference fixtures.

## Installation

```bash
npm install @streamd/html @streamd/parser
```

## Quick start

```ts
import { parse } from "@streamd/parser";
import { renderHtml } from "@streamd/html";

const { tokens } = parse("# Hello **world**\n");
const html = renderHtml(tokens);
// → <h1>Hello <strong>world</strong></h1>\n
```

## Streaming

```ts
import { streamHtml } from "@streamd/html";

let state = null;
let accumulated = "";

for await (const chunk of llmStream) {
  accumulated += chunk;
  const result = streamHtml(accumulated, state);
  state = result.state;
  render(result.html);
}
```

## Options

```ts
renderHtml(tokens, {
  xhtml: true,              // XHTML void tags (<br />) — default: true
  classPrefix: "streamd",   // CSS class prefix on block tags
  wrapRoot: true,           // Wrap in <div class="streamd-root">
  omitCodeLanguageClass: false,
  taskListCheckboxes: "disabled", // "disabled" | "none"
  math: "span-class",       // "span-class" | "tex-delim" | "none"
  plugins: [sanitize()],    // Token transforms applied before rendering
  components: { ... },      // Component overrides (see below)
});
```

## Component overrides

Replace the default renderer for any token type by passing a function
in the `components` map:

```ts
import { renderHtml } from "@streamd/html";
import type { HtmlRenderContext, TokenByType } from "@streamd/html";

const html = renderHtml(tokens, {
  components: {
    code_block: (token: TokenByType<"code_block">, ctx: HtmlRenderContext) => {
      // Custom code block rendering
      return `<div class="my-code">${ctx.escapeHtml(token.content)}</div>`;
    },
    math_block: (token, ctx) => {
      // KaTeX integration example
      return katex.renderToString(token.content, { displayMode: true });
    },
  },
});
```

The `HtmlRenderContext` provides:

- `escapeHtml(s)` — escape HTML entities in text content
- `escapeAttr(s)` — escape a value for use inside an HTML attribute
- `classPrefix` — the current CSS class prefix (empty string when disabled)
- `render(token)` — render a child token using the default renderer

## Syntax highlighting with `meta.highlight`

When a `code_block` token carries `meta.highlight` (populated by
`@streamd/plugin-shiki`), the default renderer emits structured
`<span>` elements with inline styles:

```html
<pre class="streamd-code-block" data-lang="ts" tabindex="0" role="region" aria-label="code example">
  <code><span style="color:#0000ff;font-weight:bold">const</span><span style="color:#000000"> x = </span><span style="color:#098658">1</span></code>
</pre>
```

Without `meta.highlight`, code blocks render as plain escaped text:

```html
<pre tabindex="0"><code class="language-ts">const x = 1</code></pre>
```

## Math rendering

By default, math tokens render as escaped TeX in code elements:

- `math_block` → `<pre role="math" aria-label="math block"><code class="language-math math-display">…</code></pre>`
- `math_inline` → `<code class="language-math math-inline">…</code>`

For rendered math, override via components:

```ts
import katex from "katex";

renderHtml(tokens, {
  components: {
    math_block: (t) => katex.renderToString(t.content, { displayMode: true }),
    math_inline: (t) => katex.renderToString(t.content, { displayMode: false }),
  },
});
```

## Theme stylesheets

```ts
import { renderThemeStylesheet } from "@streamd/html";
import { lightTheme } from "@streamd/tokens";

const css = renderThemeStylesheet(lightTheme, { classPrefix: "streamd" });
// Inject into a <style> tag
```

## Migration from 0.0.x

- `allowDangerousMetaHtml` is removed. Passing it throws
  `StreamdHtmlArgumentError`. Use `components.code_block` or
  `components.math_block` overrides instead.
- `HtmlBlock`, `HtmlInline`, and `Softbreak` token types no longer
  exist. Remove any code that references them.
- Token type dispatch uses string literals (`"paragraph"`, `"heading"`,
  etc.) — update any consumer code that compared against integer IDs.

## License

MIT
