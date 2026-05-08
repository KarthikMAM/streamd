# @streamd/html

HTML renderer for the [`@streamd/parser`](../parser) token tree.
Synchronous, zero runtime dependencies beyond the parser itself, and
whitespace-tolerant enough to diff against the CommonMark / GFM
reference suites.

## Install

```bash
npm install @streamd/html @streamd/parser
```

## One-shot render

```ts
import { parse } from "@streamd/parser";
import { renderHtml } from "@streamd/html";

const { tokens } = parse("# hello **world**");
console.log(renderHtml(tokens));
// => "<h1>hello <strong>world</strong></h1>\n"
```

## Streaming helper

```ts
import { streamHtml } from "@streamd/html";

let state = null;
let accumulated = "";

for await (const chunk of llm) {
  accumulated += chunk;
  const result = streamHtml(accumulated, state, { parse: { gfm: true } });
  state = result.state;
  dom.innerHTML = result.html;
}
```

`streamHtml` wraps `parse` + `renderHtml` for the common streaming
case. The parser does incremental work; the renderer produces full
HTML each call so it can be dropped into any DOM mutation strategy.

## Plugins

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { headingAnchors, linkAttributes, sanitize } from "@streamd/plugins";

const html = renderHtml(parse(src).tokens, {
  plugins: [headingAnchors(), linkAttributes(), sanitize()],
  classPrefix: "md",
  wrapRoot: true,
});
```

Plugins run before rendering. See
[`@streamd/plugins`](../plugins) for the built-ins and for the
`Plugin` interface if you want to write your own.

## Options

| Option | Default | Purpose |
|---|---|---|
| `xhtml` | `true` | `<br />` vs `<br>` self-close |
| `classPrefix` | `undefined` | Add `class="${prefix}-${kind}"` to every block |
| `wrapRoot` | `false` | Wrap output in `<div class="${prefix}-root">` (requires `classPrefix`) |
| `omitCodeLanguageClass` | `false` | Drop `class="language-…"` from fenced code |
| `taskListCheckboxes` | `"disabled"` | `"disabled"` → `<input disabled>`, `"none"` → `[ ]`/`[x]` text |
| `math` | `"span-class"` | Math rendering strategy |
| `plugins` | `[]` | Plugin pipeline applied before render |
| `allowDangerousMetaHtml` | `false` | Opt-in — splice `token.meta.html` verbatim into the output. **Required** for plugin-attached HTML (`@streamd/plugin-shiki`, `highlightCode`) to render. When `false` (default), `meta.html` is ignored and tokens render through the built-in path. See [Security](#security) below. |

## Security

### `allowDangerousMetaHtml`

`allowDangerousMetaHtml: true` tells the renderer to splice
`token.meta.html` verbatim — no escaping, no validation. It is the
only way to surface pre-rendered HTML from plugins such as Shiki or
KaTeX, but it trusts **every** plugin in the configured pipeline.
Leave at `false` when you cannot vouch for every plugin in the
pipeline (e.g. when plugins are loaded from external configuration or
user-supplied code).

`@streamd/plugins`' `sanitize()` strips `token.meta.html` by default,
so a `sanitize()` tail acts as a second line of defence even if the
renderer is allowed to render `meta.html`. See
[`@streamd/plugins`](../plugins) for the full security contract.

### Escape helpers

`@streamd/html` re-exports the internal escape helpers for callers
building HTML around the renderer:

- `escapeHtml(text)` — CommonMark text-content escape.
- `escapeAttr(value)` — attribute-value escape (safe inside `"…"`).
- `decodeEntities(text)` — resolve HTML5 named + numeric entities.
- `normalizeUrl(url)` — percent-encode per CommonMark URL rules
  without touching an existing safe encoding.

### Accessibility

The renderer emits ARIA attributes on tokens that benefit from them:

- Task-list items render as
  `<input type="checkbox" role="checkbox" aria-checked="true|false" aria-disabled="true">`,
  overriding browser defaults that do not always expose the state to
  assistive tech through the boolean `checked` attribute alone.
- Fenced code blocks with a declared language render the `<pre>` with
  `role="region"` + `aria-label="<lang> code block"` so screen
  readers can announce the block as a landmark.

## Theming

```ts
import { renderThemeStylesheet } from "@streamd/html";
import { darkTheme } from "@streamd/tokens";

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>${renderThemeStylesheet(darkTheme, { classPrefix: "md" })}</style>`,
);
```

## Validation

Public entry points throw `StreamdHtmlArgumentError` (a `TypeError`
subclass) for wrong-typed inputs. `renderHtml` insists on an array of
tokens; `streamHtml` insists on a string source.

```ts
import { renderHtml, StreamdHtmlArgumentError } from "@streamd/html";

try {
  renderHtml(null as unknown as Array<never>);
} catch (err) {
  if (err instanceof StreamdHtmlArgumentError) {
    // recover
  }
}
```

## Pairing

- Parser: [`@streamd/parser`](../parser)
- Plugins: [`@streamd/plugins`](../plugins) (+ optional adapter
  [`@streamd/plugin-shiki`](../plugin-shiki))
- Monorepo overview: [`streamd README`](../../README.md)

## License

MIT.
