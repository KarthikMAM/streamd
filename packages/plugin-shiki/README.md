# @streamd/plugin-shiki

[Shiki](https://shiki.style/) syntax-highlighter adapter for the
[`@streamd/plugins`](../plugins) pipeline. Fenced `CodeBlock` tokens
are highlighted via Shiki's bundled grammars and themes and the
structured result is stored on `token.meta.highlight` as
`HighlightData` for downstream renderers to emit styled spans
directly.

## Install

```bash
npm install @streamd/plugin-shiki @streamd/parser @streamd/plugins shiki
```

## Quick start

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { applyPlugins } from "@streamd/plugins";
import { shiki } from "@streamd/plugin-shiki";

const shikiPlugin = await shiki({
  themes: { light: "github-light", dark: "github-dark" },
  langs: ["typescript", "javascript", "bash"],
});

const { tokens } = parse(markdown);
const highlighted = applyPlugins(tokens, [shikiPlugin]).tokens;
const html = renderHtml(highlighted);
```

The factory is async because Shiki's grammar + theme init is async.
Await it once at application startup and reuse the resolved plugin
for every render.

## How it works

The plugin walks the token tree and for every `CodeBlock` token:

1. Calls `highlighter.codeToTokens(content, { lang, theme })` to get
   Shiki's structured `ThemedToken[][]`.
2. Maps each Shiki token to a `ThemedSegment { text, color?, bold?,
   italic?, underline? }`.
3. Attaches the result as `token.meta.highlight: HighlightData`.

Renderers read `meta.highlight.lines` and emit styled `<span>` or
`<Text>` trees directly — no HTML splicing, no
`allowDangerousMetaHtml`.

### Before (v0.0.1)

```ts
// Plugin set meta.html with pre-rendered HTML
renderHtml(tokens, {
  plugins: [shikiPlugin],
  allowDangerousMetaHtml: true, // no longer exists
});
```

### After (v0.0.2)

```ts
// Plugin sets meta.highlight with structured data
const highlighted = applyPlugins(tokens, [shikiPlugin]).tokens;
const html = renderHtml(highlighted);
// Renderer's default CodeBlock component reads meta.highlight
```

## Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `themes` | `{ light: string; dark: string }` | — (required) | Dual-theme configuration. The `light` theme is used for token colouring. |
| `langs` | `ReadonlyArray<string>` | common set | Restrict the grammar set Shiki loads. Pin a smaller list for faster startup. |
| `loadTheme` | `(name: string) => Promise<unknown>` | — | Escape hatch for custom themes not bundled with Shiki. |
| `onUnknownLang` | `"ignore" \| "error" \| "plaintext"` | `"plaintext"` | Behaviour for code blocks whose language is not loaded. |
| `cache` | `boolean` | `true` | Reuse highlighter instances across `shiki()` calls sharing the same `(themes, langs)`. |

### `onUnknownLang`

- `"plaintext"` (default) — highlight with Shiki's plaintext grammar
  so the block still gets structured highlight data.
- `"ignore"` — leave the token unchanged. The renderer emits its
  default code-block rendering.
- `"error"` — throw `StreamdPluginShikiArgumentError` with
  `kind: "unknown-language"`. Useful in CI to catch fenced blocks
  with mistyped languages.

## Output shape

```ts
interface HighlightData {
  readonly lines: ReadonlyArray<ReadonlyArray<ThemedSegment>>;
  readonly lang: string;
  readonly theme: string;
}

interface ThemedSegment {
  readonly text: string;
  readonly color?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
}
```

## Errors

`StreamdPluginShikiArgumentError` extends the shared
`StreamdArgumentError` from `@streamd/tokens`, so any catch that
already handles `StreamdArgumentError` covers this plugin too.

Every error carries a stable `kind` discriminator:

- `"missing-options"`, `"options-not-object"`,
  `"themes-missing"`, `"themes-not-object"`, `"theme-not-string"`,
  `"langs-not-array"`, `"load-theme-not-function"`,
  `"on-unknown-lang-invalid"` — factory-boundary validation.
- `"unknown-language"` — thrown at transform time when
  `onUnknownLang: "error"` is active and a code block's language is
  not loaded.

## Pairing

- Plugin pipeline: [`@streamd/plugins`](../plugins)
- Parser: [`@streamd/parser`](../parser)
- Monorepo overview: [`streamd README`](../../README.md)

## License

MIT.
