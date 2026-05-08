---
"@streamd/plugin-shiki": minor
---

**Breaking:** Plugin now annotates `CodeBlock.meta.highlight` with
structured `HighlightData` instead of setting `meta.html` with
pre-rendered HTML.

- `codeToTokens` replaces `codeToHtml`. Each code block receives
  `meta.highlight: HighlightData` containing per-line arrays of
  `ThemedSegment { text, color, bold, italic, underline }`.
- `meta.html` is no longer set — the field does not exist on
  `TokenMeta` in schema 2.
- `allowDangerousMetaHtml` is no longer needed or supported.
- `Plugin.requires.tokenSchema` bumped from 1 to 2.

### Migration

Consumers that passed `allowDangerousMetaHtml: true` to the renderer
must instead ensure the renderer's default `CodeBlock` component
understands `meta.highlight` (available in wave 3 renderers). Custom
`CodeBlock` components should read `token.meta.highlight.lines` and
emit styled spans directly.

```ts
// Before
renderHtml(tokens, {
  plugins: [shikiPlugin],
  allowDangerousMetaHtml: true,
});

// After
const highlighted = applyPlugins(tokens, [shikiPlugin]).tokens;
const html = renderHtml(highlighted);
// Renderer reads meta.highlight and emits styled <span> trees
```
