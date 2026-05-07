# streamd API reference

Machine-generated reference for the six published packages in the
`streamd` monorepo. For the narrative docs (quick-start, streaming
examples, performance table, compliance numbers) see the
[main README](https://github.com/KarthikMAM/streamd#readme).

## Packages

| Package                   | Purpose                                                                 |
|---------------------------|-------------------------------------------------------------------------|
| `@streamd/parser`         | Streaming-first markdown parser. Returns `ParseResult` with `stableCount`. |
| `@streamd/tokens`         | Design tokens, themes, and the shared `StreamdArgumentError` base class. |
| `@streamd/html`           | HTML renderer. Synchronous, whitespace-tolerant, CommonMark/GFM compatible. |
| `@streamd/plugins`        | Plugin pipeline + built-ins: `sanitize`, `headingAnchors`, `highlightCode`, `linkAttributes`, `frontmatter`. |
| `@streamd/react`          | React renderer, `ThemeProvider`, and the `useStreamingMarkdown` hook.   |
| `@streamd/react-native`   | React Native renderer targeting `<Text>` + `<View>` primitives.         |

## Streaming contract

See [ADR 0002](https://github.com/KarthikMAM/streamd/blob/main/docs/adr/0002-streaming-contract.md)
for the canonical statement of the `stableCount` + prefix-immutability
invariants that renderers rely on.

## Error hierarchy

All public-API validation errors extend `StreamdArgumentError` in
`@streamd/tokens`, so a single `instanceof` catch covers every package.
See the `@streamd/tokens` package page for the class definition.

## Navigation

- Browse by package in the sidebar.
- Each exported function / class / type carries the source link so you
  can jump straight to the implementation on GitHub.
- `@internal` and `@private` members are filtered out.
