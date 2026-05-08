# @streamd/react

React renderer for `@streamd/parser` token trees. Renders markdown as accessible, themeable React components with streaming support.

## Install

```bash
npm install @streamd/react @streamd/parser
```

## Quick Start

```tsx
import { StreamdMarkdown } from "@streamd/react";

function App() {
  return <StreamdMarkdown source="# Hello **world**" />;
}
```

## Component Overrides

Override any token type's default rendering by passing a `components` map keyed by token type string:

```tsx
import type { CodeBlockToken } from "@streamd/parser";
import { StreamdMarkdown } from "@streamd/react";

function MyCodeBlock({ token }: { token: CodeBlockToken }) {
  return (
    <pre className="my-code">
      <code>{token.content}</code>
    </pre>
  );
}

function App() {
  return (
    <StreamdMarkdown
      source="```js\nconsole.log('hi')\n```"
      components={{ code_block: MyCodeBlock }}
    />
  );
}
```

### KaTeX via Override

The default math components render raw TeX in `<code>`. Override to use KaTeX:

```tsx
import type { MathBlockToken } from "@streamd/parser";
import katex from "katex";

function KaTeXBlock({ token }: { token: MathBlockToken }) {
  const html = katex.renderToString(token.content, { displayMode: true });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

<StreamdMarkdown
  source="$$E = mc^2$$"
  components={{ math_block: KaTeXBlock }}
/>
```

## Streaming Reveal

The `@streamd/react/streaming` subpath provides animated text reveal for LLM streaming:

```tsx
import { useStreamingMarkdown, StreamdMarkdown } from "@streamd/react";
import {
  StreamingRevealProvider,
  useShouldStream,
} from "@streamd/react/streaming";

function StreamingChat() {
  const { tokens, append } = useStreamingMarkdown();
  const isStreaming = useShouldStream(tokens);

  // Call append(chunk) as LLM tokens arrive...

  return (
    <StreamingRevealProvider
      value={{
        isStreaming,
        granularity: "word",
        textMode: "source",
        animation: "fade-up",
      }}
    >
      <StreamdMarkdown tokens={tokens} />
    </StreamingRevealProvider>
  );
}
```

### Animation Presets

16 built-in presets: `fade`, `fade-up`, `fade-down`, `slide-in-left`, `slide-in-right`, `slide-up`, `slide-down`, `scale-up`, `scale-down`, `blur`, `blur-fade`, `blur-up`, `typewriter`, `shimmer`, `ripple`, `none`.

### Granularity

Control reveal unit size: `"char"`, `"word"`, `"line"`, `"sentence"`, `"chunk"`.

## Hooks

### `useStreamingMarkdown(initialSource?, parseOptions?)`

Incremental streaming parser hook. Call `append(chunk)` as LLM tokens arrive:

```tsx
const { tokens, stableCount, append, reset } = useStreamingMarkdown("", { gfm: true });
```

### `useShouldStream(tokens)`

Auto-detects streaming activity from token count changes. Returns `true` while tokens are actively arriving, `false` after idle.

## MemoBlock

The renderer wraps each top-level block in a `<MemoBlock>` that memoises by token reference identity. Since the parser preserves object references for completed blocks across streaming calls, stable blocks skip re-rendering entirely.

## Theme Support

```tsx
import { ThemeProvider } from "@streamd/react";
import { darkTheme } from "@streamd/tokens";

<ThemeProvider theme={darkTheme}>
  <StreamdMarkdown source="..." />
</ThemeProvider>
```

## API Reference

See the [TypeDoc documentation](https://github.com/KarthikMAM/streamd) for full API details.

## License

MIT
