---
"@streamd/plugins": minor
---

LC-parity refactor — drop HTML channel, annotate highlight as structured
data, bump token schema to 2. Four breaking changes:

- **`sanitize-not-last` ABI error kind removed.** Plugins are now fully
  order-agnostic from a safety perspective — there is no HTML channel to
  gate. The `StreamdPluginAbiErrorKind` union drops
  `"sanitize-not-last"`. Consumer code that catches this specific kind
  needs to drop the case.

- **`sanitize()` simplified.** URL-scheme check on `Link.href` and
  `Image.src` plus `meta.attrs` filtering. No longer drops
  `HtmlBlock`/`HtmlInline` tokens (those tokens don't exist in parser
  schema 2). The `allowRawHtml` option is removed from
  `SanitizeOptions`.

- **`highlightCode()` now attaches structured `HighlightData` to
  `CodeBlock.meta.highlight`** instead of setting `meta.html`.
  `HighlightFn` signature changed: returns
  `HighlightData | null | undefined` instead of
  `string | null | undefined`.

- **All built-ins require `tokenSchema: 2`.** Plugins built against
  schema 1 throw `StreamdPluginAbiError` with
  `kind: "token-schema-mismatch"` at load time.

### Migration

```ts
// Before — highlightCode returned HTML strings
highlightCode({ highlight: (code, lang) => `<pre>${code}</pre>` });

// After — return structured HighlightData
highlightCode({
  highlight: (code, lang) => ({
    lines: [[{ text: code }]],
    lang,
    theme: "light",
  }),
});

// Before — sanitize had allowRawHtml option
sanitize({ allowRawHtml: true });

// After — option removed (no HTML tokens exist)
sanitize();
```
