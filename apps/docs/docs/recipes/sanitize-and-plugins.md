---
title: Safe pipeline construction
sidebar_position: 2
---

# Safe pipeline construction

How to compose `@streamd/plugins` safely — correct `sanitize()`
ordering, when to enable `allowDangerousMetaHtml`, and how to combine
the two with pre-rendering plugins such as `@streamd/plugin-shiki`.

## The rules

1. **`sanitize()` must be the last plugin in the pipeline.** Any
   plugin that runs after it can reintroduce raw HTML, unsafe link
   schemes, or dangerous attributes. `applyPlugins` enforces this
   at load time with `StreamdPluginAbiError` and
   `kind: "sanitize-not-last"`.
2. **`meta.html` is ignored by default.** The HTML / React / React
   Native renderers refuse to splice `meta.html` unless
   `allowDangerousMetaHtml: true` is explicitly set.
3. **`sanitize()` strips `meta.html` by default.** Even if the
   renderer is told to trust it, the sanitizer removes it. Pass
   `sanitize({ allowRawHtml: true })` to let it survive.
4. **`sanitize()` rewrites link and image URLs against a scheme
   allowlist.** Default set: `http:`, `https:`, `mailto:`, `tel:`,
   `ftp:`. Anything else is replaced with a safe fallback.
5. **`sanitize()` filters `meta.attrs` against `isSafeAttributeName`.**
   The same predicate is used by the HTML renderer, so "safe
   attributes" cannot drift between the plugin-layer scrubber and
   the serialiser.

## The common pipelines

### Untrusted input, no pre-rendering

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { headingAnchors, linkAttributes, sanitize } from "@streamd/plugins";

const { tokens } = parse(userMarkdown, null, { gfm: true });
const html = renderHtml(tokens, {
  plugins: [headingAnchors(), linkAttributes(), sanitize()],
});
```

This is the baseline. Anchors on headings, `rel`/`target` on
external links, sanitize as the last step. Nothing enables
`meta.html`; the renderer produces its defaults.

### Untrusted input with trusted pre-rendering (Shiki)

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { sanitize } from "@streamd/plugins";
import { shiki } from "@streamd/plugin-shiki";

const shikiPlugin = await shiki({
  themes: { light: "github-light", dark: "github-dark" },
  langs: ["typescript", "javascript", "bash"],
});

const { tokens } = parse(userMarkdown, null, { gfm: true });
const html = renderHtml(tokens, {
  plugins: [shikiPlugin, sanitize({ allowRawHtml: true })],
  allowDangerousMetaHtml: true,
});
```

Shiki is trusted: it escapes every code token and only emits
`<pre>` / `<code>` / `<span>`. Both opt-ins are required because
`sanitize()` default-strips `meta.html` and the renderer default-ignores
it.

### Defence in depth — strip pre-rendered HTML

```ts
renderHtml(tokens, {
  plugins: [shikiPlugin, sanitize()],
  // allowDangerousMetaHtml left false; code blocks render as plain <pre><code>
});
```

Useful when the threat model distrusts Shiki's grammar files (e.g. a
supply-chain concern). Code blocks fall back to the renderer's
default emission — plain and escaped.

### Trusted input only, no sanitize

```ts
renderHtml(tokens, { allowDangerousMetaHtml: true });
```

Only appropriate when every byte of input was authored by a trusted
party. For anything the user supplied — LLM output, form input,
clipboard paste — always include `sanitize()`.

## The matrix

| Source trust | Pre-rendering plugins | `allowDangerousMetaHtml` | `sanitize()` | Outcome |
|---|---|---|---|---|
| Trusted | None | off | off | Default rendering. Safe only for trusted input. |
| Trusted | Shiki | on | off | Pre-rendered output passes through. |
| Untrusted | None | off | on | Safe defaults. Raw HTML from source dropped. |
| Untrusted | Shiki | on | `sanitize({ allowRawHtml: true })` | Trusted pre-rendering + scheme allowlist on source URLs. |
| Untrusted | Shiki | off | on (default) | Defence in depth. Code renders via defaults. |

## Why `meta.html` is gated

Plugin output is only as trustworthy as the plugin. Renderers treat
`meta.html` as "this plugin pre-rendered HTML; please splice it in".
Splicing arbitrary HTML into a page is the same hazard as
`dangerouslySetInnerHTML`. `allowDangerousMetaHtml: true` makes the
trust decision explicit and scoped to the plugin configuration you
chose.

`sanitize()` has its own opinion: it strips `meta.html` by default
because a later plugin that misbehaved (or a supply-chain compromise)
could have written anything there. `allowRawHtml: true` opts out of
that defence when you know the plugins ahead of it are producing
safe HTML.

Both flags must be flipped together to let `meta.html` survive
end-to-end.

## Writing your own plugin

Every plugin must declare the token-schema version it was built
against. See the [plugins package doc](../packages/plugins#plugin-abi)
for the full ABI contract.

```ts
import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import { walk, type Plugin } from "@streamd/plugins";

export function upperCaseHeadings(): Plugin {
  return {
    name: "upperCaseHeadings",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens) {
      return walk(tokens, {
        /* visitor */
      });
    },
  };
}
```

If `transform` throws, `applyPlugins` rewraps the error as
`StreamdPluginAbiError` with `kind: "transform-failed"` and the
plugin name on `pluginName`. Catch once at the pipeline boundary.

## Further reading

- [@streamd/plugins](../packages/plugins) — every built-in plugin
  and the full Plugin ABI.
- [Shiki integration](./shiki-integration) — step-by-step Shiki
  recipe, including the async factory lifecycle.
- [Math rendering](./math-rendering) — component-override approach for KaTeX.
