# @streamd/bench

Internal — not published. Benchmarks for the parser and renderers,
plus a comparison against `marked`, `markdown-it`, and `commonmark.js`.

## Scripts

```bash
npm run bench             # parser vs peers, static + streaming
npm run bench:baseline    # parser-only throughput baseline
npm run bench:profile     # per-chunk fast-path profile
npm run bench:renderers   # html + react renderer throughput
npm run bench:plugins     # plugin overhead (3 built-ins, 1 KB–50 KB)
```

Each script prints a markdown-style table to stdout. All measurements use
`performance.now()` and report median + p95 where applicable.
