# @streamd/parser

Streaming-first CommonMark + GFM parser. Zero runtime dependencies.
Produces a token tree (not HTML) so the output is framework-agnostic and
safe to re-render on every chunk.

## Install

```bash
npm install @streamd/parser
```

## One-shot parse

```ts
import { parse } from "@streamd/parser";

const { tokens, stableCount, state } = parse("# hello **world**");
```

`tokens` is a flat list of block tokens. Each inline-bearing token owns
its own `children` array of inline tokens. `stableCount` is the number
of tokens guaranteed not to change if the caller keeps parsing; for a
full parse it is always `tokens.length`.

## Streaming parse

```ts
import { parse, type ParserState } from "@streamd/parser";

let state: ParserState | null = null;
let src = "";

for await (const chunk of llm) {
  src += chunk;
  const result = parse(src, state);
  state = result.state;
  // `result.tokens[0..result.stableCount - 1]` are finalised and will
  // never change in subsequent calls. The rest is speculative.
  render(result.tokens);
}
```

Cost per chunk is proportional to the new content plus the active tail
block, not the full source length.

## Options

```ts
parse(src, state, {
  gfm: true,           // enable all four GFM flags below
  tables: true,
  strikethrough: true,
  taskListItems: true,
  autolinks: true,
  math: true,          // $…$ inline and $$…$$ block
});
```

All extensions default to `false`. `gfm: true` flips the four GFM
sub-flags unless individually overridden.

## Token model

See [`src/types/tokens.ts`](src/types/tokens.ts) for the full
discriminated union. Dense integer discriminants (0–22) enable jump-table
dispatch in consumers.

| Discriminant range | Meaning |
|---|---|
| 0 – 9 | Block tokens (`Blockquote`, `List`, `ListItem`, `Heading`, `Paragraph`, `CodeBlock`, `HtmlBlock`, `Hr`, `Space`, `Table`) |
| 10 – 22 | Inline tokens (`Text`, `Softbreak`, `Hardbreak`, `CodeSpan`, `Em`, `Strong`, `Strikethrough`, `Link`, `Image`, `HtmlInline`, `Escape`, `MathInline`, `MathBlock`) |

Every token carries an optional `meta?: TokenMeta` field that plugins
can use to annotate (`id`, `className`, `rel`, `target`, `html`).

## Plugin ABI

The parser also exports `TOKEN_SCHEMA_VERSION` (and the matching
`TokenSchemaVersion` type). Every `@streamd/plugins` plugin has to
declare the schema version it was built against — see
[`@streamd/plugins`](../plugins) for the `Plugin.requires` contract.

## Design + invariants

The design document in
[`.kiro/steering/parser-design.md`](../../.kiro/steering/parser-design.md)
captures the streaming invariants, fast-path cascade, and the
performance exceptions that keep the hot loop monomorphic. Do not
change the parser without reading it.

## Pairing

- HTML output: [`@streamd/html`](../html)
- React: [`@streamd/react`](../react)
- React Native: [`@streamd/react-native`](../react-native)
- Plugins: [`@streamd/plugins`](../plugins)

## License

MIT.
