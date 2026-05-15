# @streamd/html-demo

Internal — not published. Demo surfaces for
[`@streamd/html`](../../packages/html) showcasing the component-owned
rendering architecture.

## What this demo shows

1. **Default rendering** — server-side pre-rendered HTML from the sample
   markdown with themed stylesheets (light/dark).
2. **Shiki via `meta.highlight`** — the `@streamd/plugin-shiki` plugin
   annotates `CodeBlock.meta.highlight` with structured `HighlightData`;
   the default `code_block` renderer emits styled `<span>` elements
   directly (no raw HTML splicing).
3. **KaTeX via component override** — math rendering is a
   component-layer concern. The demo includes a recipe showing how
   to override `components.math_block` / `components.math_inline`
   with KaTeX's `renderToString`.
4. **Custom component overrides** — a `components.code_block` override
   that adds a language badge and reads `meta.highlight` for styled
   spans, demonstrating the extensibility mechanism.

## Surfaces

- A **Node CLI** (`cli.mjs`) that parses a markdown file (or stdin) and
  prints HTML.
- A **static web demo** (`build.mjs` + `serve.mjs`) that bundles a
  pre-rendered sample doc plus the parser and HTML renderer into a
  single-file `dist/index.html` with a live "replay as stream" button.

Neither target uses a bundler — they use Node's native ESM loader and
browser-native `<script type="module">` to keep the moving parts
minimal.

## CLI

```bash
npm run start --workspace=@streamd/html-demo          # reads apps/shared/sample.md
npm run start --workspace=@streamd/html-demo -- path/to/file.md
cat file.md | node apps/html-demo/cli.mjs -           # reads stdin
```

Output goes to stdout.

## Static web demo

Build the single-file bundle, then serve it on `localhost:4321`:

```bash
npm run build --workspace=@streamd/html-demo          # writes dist/index.html
npm run serve --workspace=@streamd/html-demo          # build + localhost:4321
```

Set `PORT` to override the port:

```bash
PORT=8080 npm run serve --workspace=@streamd/html-demo
```

Clean build output:

```bash
npm run clean --workspace=@streamd/html-demo
```

## How it works

`build.mjs` reads the sample markdown, initialises the Shiki plugin
(which annotates code blocks with structured `HighlightData`), and
pre-renders the tokens to HTML. It also renders a second copy with a
custom `components.code_block` override to demonstrate the extensibility
mechanism. Both the `@streamd/parser` and `@streamd/html` ESM bundles
are inlined into the generated page for the browser-side streaming
replay.

The "Replay as stream" button drives `parse(accumulated, state, { gfm:
true })` character-by-character to exercise the parser's incremental
state and re-render on every chunk.

## Architecture notes

- **No raw-HTML splice.** The default renderer never produces raw
  HTML from plugin output — all output is produced by typed
  component functions.
- **Math** is handled via `components.math_block` /
  `components.math_inline` overrides that call KaTeX directly
  against `token.content`.
- **`@streamd/plugin-shiki`** annotates `CodeBlock.meta.highlight` with
  `HighlightData` (structured `ThemedSegment[][]`). The renderer's
  default `code_block` component reads this and emits styled `<span>`
  elements.

## Requirements

Node 18 or newer — the `.mjs` entry points use top-level await and
`node:fs/promises`.
