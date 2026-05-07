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

Clean build output:

```bash
npm run clean --workspace=@streamd/react-native-demo
```

## What the source shows

- `src/App.tsx` — composes the chrome (title bar + theme buttons), the
  streaming-replay controls, and `<StreamdMarkdownNative>`; see the
  per-function docstrings for contracts.
- `src/main.tsx` — mounts the app inside `<StrictMode>` with a
  top-level `ErrorBoundary`.
- `src/types.ts` — hook return types (`UseStreamingSourceResult`).

The sample markdown is shared with the other demos and lives in
[`apps/shared/sample.md`](../shared/sample.md); the demo imports it
via Vite's `?raw` suffix.

## Caveat

This is a web preview, not a native build. Behaviour in Metro-driven
iOS / Android hosts may differ where `react-native-web` and Metro
diverge (for example in `Pressable` feedback, accessibility focus
order, or keyboard event delivery). Use it to iterate on layout and
token primitives, not to validate native-only code paths.
