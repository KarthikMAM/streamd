---
"@streamd/plugins": minor
---

Plugins transform `Token[] → Token[]`. The `meta.html` channel is
gone: `sanitize()` is URL-scheme + safe-attrs only; `highlightCode()`
annotates `meta.highlight` with structured `HighlightData`.
`sanitize-not-last` ABI error kind removed. All built-ins require
`tokenSchema: 2`.
