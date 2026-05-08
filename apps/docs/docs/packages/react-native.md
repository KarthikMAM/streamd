---
title: "@streamd/react-native"
sidebar_position: 5
---

# @streamd/react-native

React Native renderer for the [`@streamd/parser`](./parser) token
tree. Uses `Text` / `View` / `Pressable` / `Image` primitives, so the
same component works on iOS, Android, and the web via
`react-native-web`.

Who it's for: React Native apps that need markdown rendering —
including streaming LLM responses in a chat UI without re-mounting
the view tree on every chunk.

## Install

```bash
npm install @streamd/react-native @streamd/parser @streamd/tokens react react-native
```

`react` (18 or 19) and `react-native` (0.72+) are peer dependencies.

## Quick start

```tsx
import { StreamdMarkdownNative, ThemeProvider } from "@streamd/react-native";
import { darkTheme } from "@streamd/tokens";

export function Post({ markdown }: { markdown: string }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <StreamdMarkdownNative source={markdown} parseOptions={{ gfm: true }} />
    </ThemeProvider>
  );
}
```

### Link handling

Links render as `<Pressable>` wrapping a `<Text>`. Wire the press
handler to React Native's `Linking`:

```tsx
import { Linking } from "react-native";

<StreamdMarkdownNative
  source={markdown}
  onLinkPress={(href) => Linking.openURL(href)}
/>
```

### Streaming hook

```tsx
import { StreamdMarkdownNative, useStreamingMarkdown } from "@streamd/react-native";

export function LiveResponse() {
  const { tokens, append } = useStreamingMarkdown("", { gfm: true });

  useEffect(() => {
    const socket = openLLMSocket();
    socket.onMessage((chunk) => append(chunk));
    return () => socket.close();
  }, [append]);

  return <StreamdMarkdownNative tokens={tokens} />;
}
```

## Key APIs

| Export | Purpose |
|---|---|
| `StreamdMarkdownNative` | Component. Accepts `source` **or** `tokens`, plus `parseOptions`, `plugins`, `components`, `onLinkPress`. |
| `useStreamingMarkdown(initial, options?)` | Hook. Returns `{ tokens, stableCount, append, reset }`. |
| `ThemeProvider` | Wraps a subtree and publishes the theme via React context. |
| `useStreamdTheme()` | Read the active theme from inside a component override. |
| `renderReactNative(tokens, options?)` | Imperative API for rendering a token tree outside a component. |
| `createDefaultComponents(theme?)` | Build the default `Components` record. Useful when composing overrides. |
| `StreamdReactNativeArgumentError` | `TypeError` subclass thrown by `renderReactNative` for non-array `tokens`. |

### Component overrides

Same shape as [`@streamd/react`](./react), mapped to React Native
primitives:

```tsx
import { StreamdMarkdownNative, type CodeBlockProps } from "@streamd/react-native";
import { Text, View } from "react-native";

const components = {
  codeBlock: ({ content, lang }: CodeBlockProps) => (
    <View style={styles.code}>
      <Text style={{ color: pickLangColor(lang) }}>{content}</Text>
    </View>
  ),
};

<StreamdMarkdownNative source={md} components={components} />;
```

Override types exported for TypeScript consumers:

`BaseProps`, `CodeBlockProps`, `CodeSpanProps`, `Components`,
`HeadingProps`, `HtmlProps`, `ImageProps`, `LinkProps`, `ListItemProps`,
`ListProps`, `MathProps`, `TableProps`, `ThemeContextValue`,
`ThemeProviderProps`, `StreamdMarkdownNativeProps`,
`RenderReactNativeOptions`, `UseStreamingMarkdownResult`,
`ParsedMarkdownSnapshot`.

The [custom-components recipe](../recipes/custom-components) includes
a native example.

## Plugins

The same plugin pipeline from [`@streamd/plugins`](./plugins) works
here:

```tsx
import { linkAttributes, sanitize } from "@streamd/plugins";

<StreamdMarkdownNative
  source={untrusted}
  plugins={[linkAttributes(), sanitize()]}
/>;
```

## Web support

Uses standard React Native primitives, so it works under
`react-native-web` with the usual Vite / webpack alias. See
[`apps/react-native-demo`](https://github.com/KarthikMAM/streamd/tree/main/apps/react-native-demo)
for a browser-hosted reference.

## Security notes

- For untrusted input, always include
  [`sanitize()`](./plugins#sanitize) as the **last** plugin.
- `renderReactNative` throws `StreamdReactNativeArgumentError` (a
  `TypeError` subclass) when `tokens` is not an array.
- On native platforms, pre-rendered HTML (`meta.html` from plugins
  like `@streamd/plugin-shiki`) cannot be spliced directly into the
  view tree. For math rendering, supply component overrides for
  `math_block` / `math_inline` that use MathJax + `react-native-svg`
  or a WebView. See the [math rendering](../recipes/math-rendering)
  recipe.

## Source

- [README on GitHub](https://github.com/KarthikMAM/streamd/blob/main/packages/react-native/README.md)
- [Source tree](https://github.com/KarthikMAM/streamd/tree/main/packages/react-native/src)
