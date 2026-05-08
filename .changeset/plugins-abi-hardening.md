---
"@streamd/plugins": minor
---

Harden the plugin ABI and the `sanitize()` defense-in-depth layer. Four
breaking changes, all caught at `applyPlugins` load time by
`StreamdPluginAbiError` with a descriptive `kind`:

- **`Plugin.requires` is now mandatory.** Every plugin must declare
  `requires: { tokenSchema: TOKEN_SCHEMA_VERSION }` imported from
  `@streamd/parser`. Omitting the field throws
  `StreamdPluginAbiError` with `kind: "missing-requires"`. Third-party
  plugins compiled against an older parser schema now fail loud
  instead of silently producing malformed output. See the "Plugin
  ABI" section in the README for the declaration shape.

- **`sanitize()` must be the last plugin in the pipeline.** Any plugin
  placed after one named `"sanitize"` can reintroduce raw HTML,
  unsafe link targets, or dangerous `meta.attrs` that `sanitize` just
  scrubbed. `applyPlugins` throws
  `StreamdPluginAbiError` with `kind: "sanitize-not-last"` when
  sanitize is not the final entry. **Reorder any pipeline that used
  the `[sanitize(), …]` pattern to `[…, sanitize()]`.**

- **`sanitize()` now walks every token and strips `meta.html` plus
  validates `meta.attrs`.** Previously it handled only `HtmlBlock` /
  `HtmlInline` / `Link` / `Image`. The final pass strips
  `token.meta.html` (emitted verbatim by renderers) when
  `allowRawHtml` is false, and filters `token.meta.attrs` against a
  shared `isSafeAttributeName` allowlist (`class`, `id`, `title`,
  `alt`, `lang`, `dir`, `role`, `href`, `src`, plus `data-*` and
  `aria-*` prefix families). Keys outside the allowlist are removed
  silently.

- **Plugin errors are now isolated and wrapped.** If a plugin's
  `transform` throws, `applyPlugins` rewraps the error as
  `StreamdPluginAbiError` with `kind: "transform-failed"`, the
  offending plugin name on `pluginName`, and the original error on
  the `cause` property. Consumers catch once at the pipeline
  boundary and still get the full underlying stack.

New exports: `isSafeAttributeName`, `SAFE_ATTR_ALLOWLIST`,
`StreamdPluginAbiErrorKind`. `StreamdPluginAbiError` gains
`pluginName`, `cause`, and a narrower `kind` type
(`"token-schema-mismatch" | "missing-requires" | "sanitize-not-last" |
"transform-failed"`). The `expected` / `actual` schema-version fields
are now nullable — they are populated only for schema errors.

### Migration

```ts
// Before
import { type Plugin } from "@streamd/plugins";
const myPlugin: Plugin = {
  name: "myPlugin",
  transform: (t) => t,
};
renderHtml(tokens, { plugins: [sanitize(), linkAttributes()] });

// After
import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import { type Plugin } from "@streamd/plugins";
const myPlugin: Plugin = {
  name: "myPlugin",
  requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
  transform: (t) => t,
};
renderHtml(tokens, { plugins: [linkAttributes(), sanitize()] });
```
