---
"@streamd/react-native": minor
---

**BREAKING:** LC-parity refactor. `allowDangerousMetaHtml` removed. Component override keys switched to snake_case (`code_block`, `math_block`, `list_item`, `code_span`, `math_inline`) for API parity with `@streamd/html` and `@streamd/react`. Streaming reveal layer added (`StreamingRevealProvider`, `Words`, `useShouldStream`). Default components render `meta.highlight` as styled `<Text>` spans.
