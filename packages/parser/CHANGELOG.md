# @streamd/parser

## 0.2.0

### Minor Changes

- d259513: Token `type` fields are string literals (`"paragraph"`,
  `"code_block"`, …); `TOKEN_SCHEMA_VERSION = 2`. Final token set is
  20 — `HtmlBlock`, `HtmlInline`, `Softbreak` are absent. `CodeBlock`
  carries `lang`; no separate `info` field. `shouldEmitSpace(prev,
next)` governs block spacing. List items arriving in separate
  streaming chunks merge into a single `ListToken`.
