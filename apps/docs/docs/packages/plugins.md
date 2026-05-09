---
title: "@streamd/plugins"
sidebar_position: 6
---

# @streamd/plugins

Plugin pipeline plus five built-in plugins for the
[`@streamd/parser`](./parser) token tree. Plugins run before any
renderer and can annotate, rewrite, or drop tokens.

Who it's for: consumers that need to extend parse-to-render behaviour
with heading anchors, link attribute rewriting, code-block
pre-rendering (Shiki / Prism), math rendering (KaTeX), HTML
sanitisation, or YAML frontmatter extraction — and authors writing
their own plugins.

## Install

```bash
npm install @streamd/plugins @streamd/parser
```

## Quick start

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
[`@streamd/react`](./react) and [`@streamd/react-native`](./react-native).

### Run a pipeline directly

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

## Built-in plugins

### `headingAnchors()`

GitHub-style `id` on every heading. Duplicate slugs get `-2`, `-3`,
… suffixes. Options: `slug` (custom slug function), `maxLevel`.

### `linkAttributes()`

Injects `rel` and `target` on external links. Optional classes for
anchors. Options: `externalRel`, `externalTarget`,
`externalClassName`, `anchorClassName`, `classify`.

### `highlightCode({ highlight })`

Runs the caller-supplied `highlight` function against every
`CodeBlock`, stores the result as pre-rendered HTML on `meta.html`.
The actual renderer (Shiki / Prism / highlight.js) is yours to plug
in. For a ready-made Shiki integration, use
[`@streamd/plugin-shiki`](./plugin-shiki).

### `sanitize()` {#sanitize}

The defence-in-depth plugin. Drops `HtmlBlock` / `HtmlInline` tokens,
rewrites link / image URLs against an allowlist of schemes, strips
`meta.html` from earlier plugins (unless `allowRawHtml: true`), and
filters `meta.attrs` against a shared safe-attribute allowlist.

Options: `allowRawHtml`, `allowedProtocols`, `unsafeHrefFallback`.

**`sanitize()` must be last.** `applyPlugins` enforces this at load
time with `StreamdPluginAbiError` and `kind: "sanitize-not-last"`.
Any plugin placed after `sanitize()` could reintroduce the raw HTML,
unsafe link targets, or dangerous `meta.attrs` that `sanitize` just
removed. Reorder the list rather than catching the error.

### `frontmatter()` + `preprocessSource(src)`

Strip YAML-style frontmatter from the source before parsing.
`preprocessSource(src)` returns `{ source, frontmatter }`; run it
before `parse()`, then include `frontmatter()` in the plugin list so
downstream consumers can read the extracted data from `meta`.

## Key APIs

| Export | Purpose |
|---|---|
| `applyPlugins(tokens, plugins, options?)` | Run the pipeline. Returns `{ tokens, meta }`. Enforces the ABI and sanitize-last rule. |
| `composePlugins(name, plugins)` | Bundle multiple plugins into a single named `Plugin`. |
| `walk(tokens, visitor)` | Structural walker. Returns the input by reference when the visitor makes no changes. |
| `headingAnchors`, `linkAttributes`, `highlightCode`, `sanitize`, `frontmatter`, `preprocessSource` | Built-in plugins. |
| `isSafeAttributeName`, `SAFE_ATTR_ALLOWLIST` | The shared attribute-allowlist predicate and set. |
| `StreamdPluginAbiError` | Error subclass raised for ABI mismatches and `transform` throws. Has `kind` and `pluginName`. |
| Types | `Plugin`, `PluginContext`, `PluginRequirements`, `ApplyPluginsOptions`, `ApplyPluginsResult`, `Visitor`, `VisitResult`, `InlineVisitResult`, `SanitizeOptions`, `HeadingAnchorsOptions`, `LinkAttributesOptions`, `HighlightCodeOptions`, `HighlightFn`, `LinkClassification`, `FrontmatterResult`. |

## Plugin ABI

Every plugin **must** declare the token-schema version it was built
against:

```ts
import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import type { Plugin } from "@streamd/plugins";

export const myPlugin: Plugin = {
  name: "myPlugin",
  requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
  transform(tokens) {
    return tokens;
  },
};
```

`applyPlugins` rejects plugins that omit `requires`
(`kind: "missing-requires"`) and plugins that declare a different
version than the parser
(`kind: "token-schema-mismatch"`). The declaration is mandatory — there
is no opt-out, because silent ABI skew between parser and plugin would
produce wrong output at runtime.

If a plugin's `transform` throws, `applyPlugins` rewraps the error as
`StreamdPluginAbiError` with `kind: "transform-failed"`, the plugin
name on `pluginName`, and the original error on `cause`. Consumers
catch once at the pipeline boundary and still get the full underlying
stack.

## Writing your own

```ts
import { TokenType } from "@streamd/parser";
import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import { walk, type Plugin } from "@streamd/plugins";

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

## Security notes

- `sanitize()` is the last line of defence. Place it **last** in the
  pipeline; `applyPlugins` enforces this.
- `sanitize()` strips `meta.html` by default. Plugins that depend on
  `meta.html` reaching the renderer (`@streamd/plugin-shiki`) need
  `sanitize({ allowRawHtml: true })` plus
  `allowDangerousMetaHtml: true` on the renderer — see the
  [safe-pipeline recipe](../recipes/sanitize-and-plugins) for the
  full matrix.
- The `meta.attrs` allowlist is shared with the HTML renderer via
  `isSafeAttributeName`, so "safe attributes" cannot drift between
  the plugin-layer scrubber and the renderer serialiser.

## Source

- [README on GitHub](https://github.com/KarthikMAM/streamd/blob/main/packages/plugins/README.md)
- [Source tree](https://github.com/KarthikMAM/streamd/tree/main/packages/plugins/src)
