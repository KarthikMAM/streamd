---
title: Math rendering with KaTeX
sidebar_position: 6
---

# Math rendering with KaTeX

KaTeX is a component-layer concern — the parser emits `MathBlock` and
`MathInline` tokens with raw TeX as `content`, and consumers supply a
custom component override that calls KaTeX directly.

## Install

```bash
npm install @streamd/parser @streamd/html katex
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

Without `math: true`, `$` is a literal dollar sign — no `MathInline`
or `MathBlock` tokens are produced.

## HTML renderer

Supply `components.math_block` and `components.math_inline` functions
that call `katex.renderToString` against `token.content`:

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

## React

Supply a component override that calls `katex.renderToString` and
renders via `dangerouslySetInnerHTML` — this is the consumer's
explicit choice:

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

export function MathPost({ markdown }: { markdown: string }) {
  return (
    <StreamdMarkdown
      source={markdown}
      parseOptions={{ math: true }}
      components={{ math_block: MathBlock, math_inline: MathInline }}
    />
  );
}
```

## React Native

Use MathJax with `react-native-svg`, or a WebView-based renderer:

```tsx
import { StreamdMarkdownNative } from "@streamd/react-native";
import { MathJaxSvg } from "react-native-mathjax-html-to-svg";

function MathBlock({ token }: { token: { content: string } }) {
  return <MathJaxSvg fontSize={16}>{`$$${token.content}$$`}</MathJaxSvg>;
}

function MathInline({ token }: { token: { content: string } }) {
  return <MathJaxSvg fontSize={14}>{`$${token.content}$`}</MathJaxSvg>;
}

export function MathPost({ markdown }: { markdown: string }) {
  return (
    <StreamdMarkdownNative
      source={markdown}
      parseOptions={{ math: true }}
      components={{ math_block: MathBlock, math_inline: MathInline }}
    />
  );
}
```

## LLM streaming

For LLM output, wrap `katex.renderToString` in a try/catch — partial
math (mid-token, mid-environment) is the norm until the stream
finishes:

```ts
function safeMathRender(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: true });
  } catch {
    return `<code class="math-error">${tex}</code>`;
  }
}
```

## Migration from `@streamd/plugin-katex`

The `@streamd/plugin-katex` package has been removed. See
[migration guide](../../migration/0004-plugin-katex-removed.md) for
the full replacement pattern.

## Further reading

- [@streamd/plugins](../packages/plugins) — the plugin pipeline.
- [Safe pipeline recipe](./sanitize-and-plugins) — sanitize ordering.
