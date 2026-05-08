---
"@streamd/parser": minor
---

**BREAKING:** LC-parity refactor (token schema 2). String-discriminated tokens replace integer IDs. `HtmlBlock`, `HtmlInline`, `Softbreak` tokens removed. `CodeBlock.info` field removed (use `lang`). `shouldEmitSpace` rule set added. List-merge streaming fix. `TOKEN_SCHEMA_VERSION` bumped to 2.
