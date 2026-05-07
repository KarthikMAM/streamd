# @streamd/plugin-shiki

[Shiki](https://shiki.style/) syntax-highlighter adapter for the
[`@streamd/plugins`](../plugins) pipeline. Fenced `CodeBlock` tokens
are highlighted via Shiki's bundled grammars and themes and the
rendered HTML is stored on `token.meta.html` for downstream
renderers to splice in.

## Install

```bash
npm install @streamd/plugin-shiki @streamd/parser @streamd/plugins shiki
```

## Quick start

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { shiki } from "@streamd/plugin-shiki";

const shikiPlugin = await shiki({
  themes: { light: "github-light", dark: "github-dark" },
  langs: ["typescript", "javascript", "bash"],
});

const { tokens } = parse(markdown);
const html = renderHtml(tokens, {
  plugins: [shikiPlugin],
  allowDangerousMetaHtml: true,
});
```

The factory is async because Shiki's grammar + theme init is async.
Await it once at application startup and reuse the resolved plugin
for every render.

## ⚠️ Security contract — `allowDangerousMetaHtml` is required

This plugin writes Shiki's pre-rendered HTML into `token.meta.html`.
Renderers **ignore `meta.html` by default** — you must opt in with
`allowDangerousMetaHtml: true` on the renderer options for Shiki's
output to actually appear in the page:

```ts
renderHtml(tokens, {
  plugins: [shikiPlugin],
  allowDangerousMetaHtml: true, // ⚠️ required for Shiki output to render
});
```

### Why this flag exists

`allowDangerousMetaHtml: true` tells the renderer to splice
`meta.html` verbatim — no escaping, no validation. Shiki's output is
safe by construction (it escapes every code token and only emits
`<pre>` / `<code>` / `<span>` tags), so opting in is appropriate
here.

But the same flag also trusts **every other plugin in the pipeline**
to produce safe HTML. If you add a plugin later that writes unsafe
HTML to `meta.html`, that HTML will render without sanitisation.
Only enable the flag when you control every plugin in your
configured pipeline.

### Using `sanitize()` with `shiki`

If your pipeline ends with `sanitize()` (the default defence-in-depth
recipe from `@streamd/plugins`), note that `sanitize()` strips
`meta.html` by default as a fallback against misbehaving plugins.
Two viable combinations:

```ts
// Trust shiki explicitly — sanitize keeps the pre-rendered HTML
renderHtml(tokens, {
  plugins: [shikiPlugin, sanitize({ allowRawHtml: true })],
  allowDangerousMetaHtml: true,
});

// Defence in depth — sanitize strips shiki output entirely
renderHtml(tokens, {
  plugins: [shikiPlugin, sanitize()],
  // allowDangerousMetaHtml left false; code blocks render as plain <pre><code>
});
```

The second form falls back to the renderer's default code-block
emission — useful when the threat model distrusts Shiki's grammar
files (e.g. a supply-chain concern).

## Options

| Option | Type | Default | Meaning |
|---|---|---|---|
| `themes` | `{ light: string; dark: string }` | — (required) | Dual-theme configuration. Values are Shiki bundled theme names or custom names resolved through `loadTheme`. |
| `langs` | `ReadonlyArray<string>` | common set | Restrict the grammar set Shiki loads. Pin a smaller list for faster startup. |
| `loadTheme` | `(name: string) => Promise<unknown>` | — | Escape hatch for custom themes not bundled with Shiki. Called once per theme name in `themes`. |
| `onUnknownLang` | `"ignore" \| "error" \| "plaintext"` | `"plaintext"` | Behaviour for code blocks whose language is not loaded. |
| `cache` | `boolean` | `true` | Reuse highlighter instances across `shiki()` calls sharing the same `(themes, langs)`. |

### `onUnknownLang`

- `"plaintext"` (default) — highlight with Shiki's plaintext grammar
  so the block still gets themed output.
- `"ignore"` — leave the token unchanged. The renderer emits its
  default `<pre><code>` fallback.
- `"error"` — throw `StreamdPluginShikiArgumentError` with
  `kind: "unknown-language"`. Useful in CI to catch fenced blocks
  with mistyped languages.

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

## Using with React / React Native

The same opt-in pattern applies to [`@streamd/react`](../react) and
[`@streamd/react-native`](../react-native) — each renderer exposes
its own `allowDangerousMetaHtml` prop on the top-level component. On
React Native the default `codeBlock` still ignores `meta.html` (RN
has no safe raw-HTML path), but custom `codeBlock` overrides (e.g. a
`WebView`-backed component) can consume the highlighted HTML once
the flag is set.

## Pairing

- Plugin pipeline: [`@streamd/plugins`](../plugins)
- Parser: [`@streamd/parser`](../parser)
- Math adapter: [`@streamd/plugin-katex`](../plugin-katex)
- Monorepo overview: [`streamd README`](../../README.md)

## License

MIT.
