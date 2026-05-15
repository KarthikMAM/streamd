---
title: "@streamd/react"
sidebar_position: 4
---

# @streamd/react

React renderer for the [`@streamd/parser`](./parser) token tree. Ships
a `<StreamdMarkdown>` component, a `useStreamingMarkdown` hook, full
component overrides for every token kind, and a `<ThemeProvider>` that
maps [`@streamd/tokens`](./tokens) onto CSS variables.

Who it's for: React apps that need markdown rendering — including
streaming LLM output without re-mounting the component tree on every
chunk.

## Install

```bash
npm install @streamd/react @streamd/parser @streamd/tokens react react-dom
```

`react` and `react-dom` are peer dependencies (18 or 19).

## Quick start

```tsx
import { StreamdMarkdown, ThemeProvider } from "@streamd/react";
import { darkTheme } from "@streamd/tokens";

export function Post({ markdown }: { markdown: string }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <StreamdMarkdown source={markdown} parseOptions={{ gfm: true }} />
    </ThemeProvider>
  );
}
```

`<ThemeProvider>` is optional — it injects CSS custom properties so
the built-in components pick up the active theme. Skip it if you are
supplying your own styles.

### Streaming hook

```tsx
import { StreamdMarkdown, useStreamingMarkdown } from "@streamd/react";

export function LiveResponse() {
  const { tokens, append } = useStreamingMarkdown("", { gfm: true });

  useEffect(() => {
    const socket = openLLMSocket();
    socket.onMessage((chunk) => append(chunk));
    return () => socket.close();
  }, [append]);

  return <StreamdMarkdown tokens={tokens} />;
}
```

The hook holds the `ParserState` internally and re-renders the host
component when new tokens arrive. The
[LLM streaming recipe](../recipes/llm-streaming) covers the full
wiring from a streaming fetch to a live-rendering component.

## Key APIs

| Export | Purpose |
|---|---|
| `StreamdMarkdown` | Component. Accepts `source` (raw markdown) **or** `tokens` (pre-parsed), plus `parseOptions`, `plugins`, `components`. |
| `useStreamingMarkdown(initial, options?)` | Hook. Returns `{ tokens, stableCount, append, reset }`. |
| `ThemeProvider` | Wraps a subtree and publishes the theme via React context + CSS variables. |
| `useStreamdTheme()` | Read the active theme from inside a component override. |
| `renderReact(tokens, options?)` | Lower-level imperative API for rendering a token tree outside a component. |
| `createDefaultComponents(theme?)` | Build the default `Components` record. Useful when composing overrides. |
| `StreamdReactArgumentError` | `TypeError` subclass thrown by `renderReact` for non-array `tokens`. |

### Component overrides

Every token kind maps to a component you can replace:

```tsx
import { StreamdMarkdown, type HeadingProps, type LinkProps } from "@streamd/react";

const components = {
  heading: ({ level, id, children }: HeadingProps) =>
    React.createElement(`h${level}`, { id, className: "my-heading" }, children),
  link: ({ href, children, rel, target }: LinkProps) => (
    <a href={href} rel={rel} target={target} className="my-link">
      {children}
    </a>
  ),
};

<StreamdMarkdown source={md} components={components} />;
```

Override types exported for TypeScript consumers:

`BaseProps`, `CodeBlockProps`, `CodeSpanProps`, `Components`,
`HeadingProps`, `HtmlProps`, `ImageProps`, `LinkProps`, `ListItemProps`,
`ListProps`, `MathProps`, `TableProps`, `ThemeContextValue`,
`ThemeProviderProps`, `StreamdMarkdownProps`, `RenderReactOptions`,
`UseStreamingMarkdownResult`, `ParsedMarkdownSnapshot`.

The [custom-components recipe](../recipes/custom-components) walks
through a complete override with inline styles.

## Plugins

```tsx
import { StreamdMarkdown } from "@streamd/react";
import { headingAnchors, linkAttributes, sanitize } from "@streamd/plugins";

<StreamdMarkdown
  source={userMarkdown}
  parseOptions={{ gfm: true }}
  plugins={[headingAnchors(), linkAttributes(), sanitize()]}
/>;
```

See the [safe-pipeline recipe](../recipes/sanitize-and-plugins) for
ordering rules.

## Security notes

- For untrusted input, always include
  [`sanitize()`](./plugins#sanitize) as the **last** plugin.
- `meta.html` produced by plugins (`@streamd/plugin-shiki`) is
  **ignored by default**. Opt in via `allowDangerousMetaHtml: true`
  on the renderer options. That flag trusts every plugin currently in
  the pipeline — see the [Shiki integration recipe](../recipes/shiki-integration)
  for the combinations that work with `sanitize()`.
- Math rendering is a component-layer concern — supply
  `components.math_block` / `components.math_inline` overrides. See
  the [math rendering](../recipes/math-rendering) recipe.
- `renderReact` throws `StreamdReactArgumentError` (a `TypeError`
  subclass) when `tokens` is not an array.

## Source

- [README on GitHub](https://github.com/KarthikMAM/streamd/blob/main/packages/react/README.md)
- [Source tree](https://github.com/KarthikMAM/streamd/tree/main/packages/react/src)
