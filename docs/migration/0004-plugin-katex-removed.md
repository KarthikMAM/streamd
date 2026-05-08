# Migration: `@streamd/plugin-katex` removed

**ADR:** [0004-lc-parity-refactor](../adr/0004-lc-parity-refactor.md)
**Wave:** 2c/6

## Why

The LC-parity refactor enforces a hard constraint: **HTML is never
emitted by the parser or any plugin.** `@streamd/plugin-katex` called
`katex.renderToString` and stored the resulting HTML on
`token.meta.html` — a channel that no longer exists. KaTeX produces
HTML only; it has no structured output format that a token-annotation
plugin could attach.

The parser already emits `MathBlock` and `MathInline` tokens with raw
TeX as `content` (delimiters stripped). Rendering math is now a
component-layer concern: consumers supply a custom component override
that calls KaTeX directly against `token.content`.

## Replacement pattern

### `@streamd/html`

Supply `components.math_block` and `components.math_inline` functions:

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import katex from "katex";

const { tokens } = parse(markdown, null, { math: true });

const html = renderHtml(tokens, {
  components: {
    math_block: (token) =>
      `<div class="math-display">${katex.renderToString(token.content, { displayMode: true })}</div>`,
    math_inline: (token) =>
      katex.renderToString(token.content, { displayMode: false }),
  },
});
```

### `@streamd/react`

Supply component overrides that call `katex.renderToString` and wrap
the result in a `dangerouslySetInnerHTML` span — this is the
consumer's explicit choice (streamd's core ships no HTML splice):

```tsx
import { StreamdMarkdown } from "@streamd/react";
import katex from "katex";

function MathBlock({ token }: { token: { content: string } }) {
  const html = katex.renderToString(token.content, { displayMode: true });
  return <div className="math-display" dangerouslySetInnerHTML={{ __html: html }} />;
}

function MathInline({ token }: { token: { content: string } }) {
  const html = katex.renderToString(token.content, { displayMode: false });
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

<StreamdMarkdown
  source={markdown}
  parseOptions={{ math: true }}
  components={{ math_block: MathBlock, math_inline: MathInline }}
/>
```

### `@streamd/react-native`

Supply a component that renders TeX via MathJax + `react-native-svg`,
or a WebView override:

```tsx
import { StreamdMarkdownNative } from "@streamd/react-native";
import { MathJaxSvg } from "react-native-mathjax-html-to-svg";

function MathBlock({ token }: { token: { content: string } }) {
  return <MathJaxSvg fontSize={16}>{`$$${token.content}$$`}</MathJaxSvg>;
}

function MathInline({ token }: { token: { content: string } }) {
  return <MathJaxSvg fontSize={14}>{`$${token.content}$`}</MathJaxSvg>;
}

<StreamdMarkdownNative
  source={markdown}
  parseOptions={{ math: true }}
  components={{ math_block: MathBlock, math_inline: MathInline }}
/>
```

## What to remove from your code

1. `npm uninstall @streamd/plugin-katex`
2. Remove `import { katex } from "@streamd/plugin-katex"` and any
   `katex()` factory call.
3. Remove `allowDangerousMetaHtml: true` if it was only needed for
   KaTeX (keep it if you still use `@streamd/plugin-shiki`).
4. Add the appropriate component override from the patterns above.
5. Keep `katex` as a direct dependency — you now call it yourself.
6. Keep loading `katex.min.css` — the rendered output still needs it.

## LLM streaming

For LLM output, wrap `katex.renderToString` in a try/catch — partial
math is the norm until the stream finishes:

```ts
function safeMathRender(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: true });
  } catch {
    return `<code class="math-error">${tex}</code>`;
  }
}
```

Use `safeMathRender` inside your component override to gracefully
handle incomplete TeX during streaming.
