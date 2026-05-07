# @streamd/html-demo

Internal — not published. Two demo surfaces for
[`@streamd/html`](../../packages/html):

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

`build.mjs` reads the sample markdown, pre-renders it to HTML on the
server side, and inlines both the `@streamd/parser` and `@streamd/html`
ESM bundles into the generated page. The "Replay as stream" button in
the browser drives `parse(accumulated, state, { gfm: true })`
character-by-character to exercise the parser's incremental state and
re-render on every chunk.

## Requirements

Node 18 or newer — the `.mjs` entry points use top-level await and
`node:fs/promises`.
