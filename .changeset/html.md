---
"@streamd/html": minor
---

String-literal token dispatch, default component per token type, new
`components` override map keyed by `TokenTypeValue`. `CodeBlock`
renders `meta.highlight` as styled spans when present; math renders
raw TeX in monospace. No `meta.html` handling, no
`allowDangerousMetaHtml`.
