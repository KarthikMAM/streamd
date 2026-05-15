---
"@streamd/plugin-shiki": minor
---

`shiki()` returns a plugin that annotates `CodeBlock.meta.highlight`
with structured `HighlightData` (per-line `ThemedSegment[][]`) via
`codeToTokens`. Renderer components read this and emit styled spans
/ `<Text>` trees directly.
