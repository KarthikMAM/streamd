# @streamd/plugins

Plugin pipeline and five built-in plugins for the
[`@streamd/parser`](../parser) token tree. Plugins run before any
renderer and can annotate, rewrite, or drop tokens.

## Install

```bash
npm install @streamd/plugins @streamd/parser
```

## Apply plugins

Most callers pass plugins directly to a renderer:

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { headingAnchors, linkAttributes, sanitize } from "@streamd/plugins";

const { tokens } = parse(markdown, null, { gfm: true });
const html = renderHtml(tokens, {
  plugins: [headingAnchors(), linkAttributes(), sanitize()],
});
```

The same `plugins: [...]` option is accepted by
[`@streamd/react`](../react) and
[`@streamd/react-native`](../react-native).

### `sanitize()` must be last

`applyPlugins` enforces `sanitize()` as the final entry in the
pipeline. Any plugin placed after `sanitize()` can reintroduce the raw
HTML, unsafe link targets, or dangerous `meta.attrs` that `sanitize`
just removed, so the check fires at load time with
`StreamdPluginAbiError` and `kind: "sanitize-not-last"`. Reorder the
list rather than catching the error.

You can also run a pipeline directly:

```ts
import { applyPlugins, composePlugins } from "@streamd/plugins";

const bundle = composePlugins("safe-publish", [
  headingAnchors(),
  linkAttributes(),
  sanitize(),
]);
const { tokens: transformed, meta } = applyPlugins(tokens, [bundle]);
```

The `meta` bag is shared across the pipeline — plugins can use it to
exchange state.

## Plugin ABI

Every plugin **must** declare the token-schema version it was built
against. `applyPlugins` rejects plugins that omit `requires` (with
`StreamdPluginAbiError` and `kind: "missing-requires"`) and plugins
that declare a version different from the parser's
`TOKEN_SCHEMA_VERSION` (`kind: "token-schema-mismatch"`).

```ts
import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import type { Plugin } from "@streamd/plugins";

export const myPlugin: Plugin = {
  name: "myPlugin",
  requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
  transform(tokens) { return tokens; },
};
```

The declaration is mandatory — there is no opt-out. Silent ABI skew
between parser and plugin would produce wrong output at runtime; the
loud error forces the mismatch to surface immediately.

## Plugin error isolation

If a plugin's `transform` throws, `applyPlugins` rewraps the error as
`StreamdPluginAbiError` with `kind: "transform-failed"`, the plugin
name on `pluginName`, and the original error on the `cause` property.
Consumers catch once at the pipeline boundary and still get the full
underlying stack.

## Built-in plugins

| Plugin | Effect |
|---|---|
| `headingAnchors({ slug?, maxLevel? })` | GitHub-style `id` on every heading, with `-2`/`-3` suffixes for duplicates |
| `linkAttributes({ externalRel?, externalTarget?, externalClassName?, anchorClassName?, classify? })` | `rel`/`target` on external links, optional classes for anchors |
| `highlightCode({ highlight, includeUnknown? })` | Store pre-rendered HTML on fenced code via `meta.html`; hook for Shiki / Prism / etc. |
| `sanitize({ allowRawHtml?, allowedProtocols?, unsafeHrefFallback? })` | Drop raw HTML, rewrite unsafe link schemes, strip `meta.html`, filter `meta.attrs` against a shared allowlist |
| `frontmatter()` + `preprocessSource(src)` | Strip YAML-style frontmatter from the source string before parsing |

### `sanitize()` — defense in depth

In addition to dropping `HtmlBlock` / `HtmlInline` tokens and
rewriting unsafe link schemes, `sanitize()` walks **every** token to:

- Strip `meta.html` (which renderers emit verbatim) unless
  `allowRawHtml: true` is set. This catches HTML smuggled in via
  earlier plugins (e.g. a misbehaving syntax-highlighter that
  produced raw HTML).
- Filter `meta.attrs` keys against the shared `isSafeAttributeName`
  allowlist: exact names `class`, `id`, `title`, `alt`, `lang`,
  `dir`, `role`, `href`, `src`, plus the `data-*` and `aria-*`
  prefix families. Everything else (`onclick`, `style`, `formaction`,
  …) is removed silently.

The HTML renderer uses the same `isSafeAttributeName` predicate, so
"safe attributes" cannot drift between the plugin-layer scrubber and
the renderer serialiser.

## Writing your own

```ts
import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import { walk, type Plugin } from "@streamd/plugins";
import { TokenType } from "@streamd/parser";

export function upperCaseHeadings(): Plugin {
  return {
    name: "upperCaseHeadings",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens) {
      return walk(tokens, {
        inline(token) {
          if (token.type !== TokenType.Text) return undefined;
          return { ...token, content: token.content.toUpperCase() };
        },
      });
    },
  };
}
```

`walk` is structural — it returns the input by reference when the
visitor makes no changes, so applying a noop plugin on a 50 KB
document is free.

## Pairing

- Parser: [`@streamd/parser`](../parser)
- HTML renderer: [`@streamd/html`](../html)
- React renderer: [`@streamd/react`](../react)
- React Native renderer: [`@streamd/react-native`](../react-native)
- Adapters that need `allowDangerousMetaHtml`:
  [`@streamd/plugin-shiki`](../plugin-shiki),
  [`@streamd/plugin-katex`](../plugin-katex)
- Monorepo overview: [`streamd README`](../../README.md)

## License

MIT.
