---
"@streamd/cli": minor
---

Ship `@streamd/cli` — the `streamd` command-line front end for the
streamd toolchain.

`streamd` streams stdin through `@streamd/parser` + `@streamd/html`
+ `@streamd/plugins` and writes HTML to stdout. First-class support
for incremental LLM streams (common-prefix delta mode), the full
plugin surface via flags (`--anchors`, `--link-attrs`,
`--sanitize` / `--no-sanitize`, `--allow-dangerous-meta-html`),
`@streamd/tokens` theming (`--theme light|dark|none`,
`--class-prefix`, `--wrap-root`), and a programmatic `run(argv,
streams)` API so tests and downstream tools can drive the pipeline
without spawning a child process.

Quick start:

```bash
npm install -g @streamd/cli
echo '# hello **world**' | streamd
# => <h1>hello <strong>world</strong></h1>

llm chat --stream | streamd --gfm --stream delta
```

Full flag reference, streaming-mode semantics, and security notes in
[`packages/cli/README.md`](../packages/cli/README.md).
