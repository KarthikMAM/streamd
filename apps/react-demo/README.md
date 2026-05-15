# @streamd/react-demo

Internal — not published. Vite + React demo for
[`@streamd/react`](../../packages/react). Exercises the renderer end
to end:

- **Live parse** — the editor pane pipes its source through
  `<StreamdMarkdown source={...} />`, which re-parses incrementally
  on every keystroke.
- **Theming** — the header button group flips between `lightTheme`
  and `darkTheme` from [`@streamd/tokens`](../../packages/tokens)
  through `<ThemeProvider>`.
- **Component overrides** — custom `code_block`, `math_block`, and
  `math_inline` components demonstrate the `components` prop API.
- **KaTeX-via-override** — math rendering uses KaTeX through a
  component override (the consumer's explicit choice, no flag
  required).
- **Streaming reveal** — the bottom panel uses
  `useStreamingMarkdown` + `StreamingRevealProvider` to replay
  markdown with animated text reveal.

## Run locally

```bash
npm install                                             # from the repo root
npm run dev --workspace=@streamd/react-demo             # vite on http://localhost:4322
```

## Build

```bash
npm run build --workspace=@streamd/react-demo
# output: apps/react-demo/dist/
```

## Component overrides

The demo passes a `components` map to `<StreamdMarkdown>`:

```tsx
import type { ReactComponents } from "@streamd/react";

const CUSTOM_COMPONENTS: ReactComponents = {
  code_block: CustomCodeBlock,
  math_block: CustomMathBlock,
  math_inline: CustomMathInline,
};

<StreamdMarkdown source={src} components={CUSTOM_COMPONENTS} />
```

- `CustomCodeBlock` reads `token.meta.highlight` (populated by
  plugin-shiki) and renders styled `<span>` elements per segment.
- `CustomMathBlock` / `CustomMathInline` call
  `katex.renderToString(token.content)` and use
  `dangerouslySetInnerHTML` — the consumer's explicit choice.

## Streaming reveal

The streaming replay panel wraps output in a
`<StreamingRevealProvider>` and uses `useShouldStream(tokens)` to
auto-detect when tokens are arriving:

```tsx
import {
  StreamingRevealProvider,
  useShouldStream,
  type StreamingAnimationPreset,
} from "@streamd/react/streaming";

const isStreaming = useShouldStream(tokens);
const config = { isStreaming, granularity: "word", textMode: "source", animation: preset };

<StreamingRevealProvider value={config}>
  <StreamdMarkdown tokens={tokens} />
</StreamingRevealProvider>
```

Three presets are showcased via a UI selector: `fade`, `slide-up`,
and `typewriter`. The full set of 16 presets is available from
`ANIMATION_PRESETS`.

## What the source shows

- `src/App.tsx` — composes `ThemeSelector`, `<StreamdMarkdown>` with
  component overrides, and the `StreamingReplay` panel with reveal.
- `src/components.tsx` — custom code block (reads `meta.highlight`)
  and custom math components (KaTeX-via-override recipe).
- `src/main.tsx` — mounts the app inside `<StrictMode>` with a
  top-level `ErrorBoundary`.
- `src/types.ts` — hook return types and component prop interfaces.

The sample markdown is shared with the other demos and lives in
[`apps/shared/sample.md`](../shared/sample.md); the demo imports it
via Vite's `?raw` suffix and appends math content to demonstrate
the KaTeX override.
