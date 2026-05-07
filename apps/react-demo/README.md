# @streamd/react-demo

Internal — not published. Vite + React demo for
[`@streamd/react`](../../packages/react). Exercises the renderer end
to end:

- **`streamHtml` / live parse** — the editor pane pipes its source
  through `<StreamdMarkdown source={...} />`, which re-parses
  incrementally on every keystroke.
- **Theming** — the header button group flips between `lightTheme`
  and `darkTheme` from [`@streamd/tokens`](../../packages/tokens)
  through `<ThemeProvider>`.
- **Streaming replay** — the bottom panel uses
  `useStreamingMarkdown` to replay the editor's current source
  character-by-character, simulating an LLM token stream.

## Run locally

```bash
npm install                                             # from the repo root
npm run dev --workspace=@streamd/react-demo             # vite on http://localhost:5173
```

## Build

```bash
npm run build --workspace=@streamd/react-demo
# output: apps/react-demo/dist/
```

Preview the production build:

```bash
npm run preview --workspace=@streamd/react-demo
```

Clean build output:

```bash
npm run clean --workspace=@streamd/react-demo
```

## What the source shows

- `src/App.tsx` — composes `ThemeSelector`, `<StreamdMarkdown>`, and
  the `StreamingReplay` panel; see the component docstrings for the
  per-component contract.
- `src/main.tsx` — mounts the app inside `<StrictMode>` with a
  top-level `ErrorBoundary`.
- `src/types.ts` — hook return types (`UseLiveParseResult`).

The sample markdown is shared with the other demos and lives in
[`apps/shared/sample.md`](../shared/sample.md); the demo imports it
via Vite's `?raw` suffix.
