# @streamd/react-native-demo

Internal — not published. Web-hosted preview for
[`@streamd/react-native`](../../packages/react-native) running through
[`react-native-web`](https://necolas.github.io/react-native-web/) in
Vite. No Metro, no Xcode, no Android Studio — `npm run dev` spins up a
browser build that renders the native `Text` / `View` / `Pressable`
primitives via their web shims.

## Why the Vite alias

`vite.config.ts` aliases every `react-native` import to
`react-native-web` so the renderer's primitive imports resolve to web
components. The alias lives in one place:

```ts
resolve: {
  alias: { "react-native": "react-native-web" },
  extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".js", ".jsx"],
},
```

`react-native` itself is still declared as a dependency in
`package.json` so TypeScript picks up the primitive types directly
rather than routing them through the alias.

## Run locally

```bash
npm install                                                   # from the repo root
npm run dev --workspace=@streamd/react-native-demo            # vite on http://localhost:4323
```

## Build

```bash
npm run build --workspace=@streamd/react-native-demo
# output: apps/react-native-demo/dist/
```

Preview the production build:

```bash
npm run preview --workspace=@streamd/react-native-demo
```

## What the demo shows

### Component overrides

The demo passes a `components` prop to `<StreamdMarkdownNative>` with
two custom components:

- **`code_block`** — reads `meta.highlight` (populated by `plugin-shiki`)
  and renders per-segment `<Text>` nodes with `color` / `fontStyle` /
  `fontWeight` props. Falls back to plain monospace when no highlight
  data is present.
- **`math_block`** — demonstrates the KaTeX-via-override pattern. The web
  path renders raw TeX in a styled container with a "TeX" badge. In a
  production app this component would call `katex.renderToString(content)`
  and inject the result.

### KaTeX-via-override patterns

Two paths exist for rendering math in React Native:

| Path | Implementation |
|------|---------------|
| **Web** (react-native-web) | Override `math_block` / `math_inline` with a component that calls `katex.renderToString(content)` and renders the HTML via a web view or `dangerouslySetInnerHTML`. |
| **Native** (iOS / Android) | Override `math_block` / `math_inline` with a component that uses MathJax + `react-native-svg` to render TeX to SVG elements. |

This demo implements the **web path** end-to-end (simplified — shows raw
TeX in a styled view rather than calling KaTeX, to avoid adding a heavy
dependency to the demo).

### Streaming reveal

The demo wraps the renderer in `<StreamingRevealProvider>` from
`@streamd/react-native/streaming`. Three animation presets are
available — cycle through them with the "Animation: …" button:

- `fade` — opacity 0 → 1
- `blur` — blur + opacity reveal
- `slide-in-left` — translateX(-8px) + opacity

The streaming reveal layer is driven by React render timing, not parser
state. The parser's `stableCount` is the finality signal; animation is
purely a UX concern.

**Known limitation:** The core `Animated` API (used on native instead of
Reanimated) does not support the `blur` filter natively. On iOS/Android
the `blur` preset degrades to a simple opacity fade. This is a
documented trade-off from wave 3c — Reanimated support is planned as a
follow-up.

### Plugin-shiki integration

When `plugin-shiki` is applied to the token pipeline, it attaches
structured `HighlightData` to `CodeBlock.meta.highlight`. The custom
`code_block` component reads this data and renders colored text segments
directly — no HTML splicing, no `allowDangerousMetaHtml`.

## Component key convention: snake_case

All three renderers (`@streamd/html`, `@streamd/react`,
`@streamd/react-native`) use **snake_case** component keys matching the
token `.type` string discriminants: `code_block`, `math_block`,
`math_inline`, `list_item`, `code_span`, etc. This means
`components.code_block` reads naturally alongside `token.type ===
"code_block"`.

## Caveat

This is a web preview, not a native build. Behaviour in Metro-driven
iOS / Android hosts may differ where `react-native-web` and Metro
diverge (for example in `Pressable` feedback, accessibility focus
order, or keyboard event delivery). Use it to iterate on layout and
token primitives, not to validate native-only code paths.
