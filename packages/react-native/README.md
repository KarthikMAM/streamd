# @streamd/react-native

React Native renderer for the [`@streamd/parser`](../parser) token
tree. Uses `Text` / `View` / `Pressable` / `Image` primitives so the
same component works on iOS, Android, and the web (via
`react-native-web`).

## Install

```bash
npm install @streamd/react-native @streamd/parser @streamd/tokens react react-native
```

`react` (18 or 19) and `react-native` (0.72+) are peer dependencies.

## Render markdown

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

## Link handling

```tsx
<StreamdMarkdownNative
  source={markdown}
  onLinkPress={(href) => Linking.openURL(href)}
/>
```

Links render as `<Pressable>` wrapping a `<Text>` and call
`onLinkPress` when tapped.

## Streaming hook

`useStreamingMarkdown` mirrors the hook from
[`@streamd/react`](../react): accumulate source, append incrementally,
render into `<StreamdMarkdownNative>` while the stream is live.

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

## Component overrides

Every token kind has a matching component you can replace — same shape
as [`@streamd/react`](../react) but mapped to React Native primitives.
Keys match the token's `.type` discriminant (snake_case):

```tsx
const components = {
  code_block: ({ content, lang }) => (
    <View style={styles.code}>
      <Text style={{ color: pickLangColor(lang) }}>{content}</Text>
    </View>
  ),
};

<StreamdMarkdownNative source={md} components={components} />;
```

## Plugins

The same plugin pipeline from [`@streamd/plugins`](../plugins) works
here:

```tsx
import { sanitize, linkAttributes } from "@streamd/plugins";

<StreamdMarkdownNative
  source={untrusted}
  plugins={[linkAttributes(), sanitize()]}
/>;
```

Plugins annotate tokens via `meta` (structured data only — no raw
HTML). The default `code_block` component reads `meta.highlight`
(populated by `plugin-shiki`) and renders styled `<Text>` spans.
Override `math_block` / `math_inline` with a KaTeX or MathJax
component to render TeX:

```tsx
<StreamdMarkdownNative
  source={markdown}
  plugins={[shikiPlugin]}
  components={{ code_block: HighlightedCodeBlock, math_block: KaTeXBlock }}
/>
```

## Direct render function

`renderReactNative(tokens, options?)` returns a `ReactNode` for
callers that want to skip the `<StreamdMarkdownNative>` wrapper:

```tsx
import { parse } from "@streamd/parser";
import { renderReactNative } from "@streamd/react-native";

const { tokens } = parse("# hello");
const node = renderReactNative(tokens);
```

`createDefaultComponents()` returns the built-in component map for
callers that want to spread the defaults into a partial override.

## Accessibility

The default components emit React Native accessibility props on
tokens that benefit from them:

- Headings render with `accessibilityRole="header"` and an
  `accessibilityLabel` so `VoiceOver` / `TalkBack` announce them as
  landmarks with level information.
- Task-list items render with `accessibilityRole="checkbox"` and
  `accessibilityState={{ checked, disabled: true }}` so assistive
  tech announces the checked state consistently.

## Validation

`renderReactNative` throws `StreamdReactNativeArgumentError` (a
`TypeError` subclass extending `StreamdArgumentError` from
`@streamd/tokens`) when `tokens` is not an array, or when a caller
passes a non-string to `append` on the streaming hook.

## Web support

Uses standard React Native primitives, so it works under
`react-native-web` with the usual Vite / webpack alias. See
[`apps/react-native-demo`](https://github.com/KarthikMAM/streamd/tree/main/apps/react-native-demo)
for a browser-hosted reference.

## Pairing

- Parser: [`@streamd/parser`](../parser)
- Plugins: [`@streamd/plugins`](../plugins)
- Monorepo overview: [`streamd README`](../../README.md)

## License

MIT.
