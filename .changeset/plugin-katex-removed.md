---
"@streamd/plugins": minor
---

**`@streamd/plugin-katex` removed.** KaTeX produces HTML only — under
the LC-parity constraint that HTML is never emitted by the parser or
any plugin, plugin-katex has no valid form as a token-annotation plugin.

The parser emits `MathBlock` / `MathInline` tokens with raw TeX as
`content`. Consumers who want rendered math supply a
`components.math_block` / `components.math_inline` override that calls
KaTeX directly against `token.content`.

### Migration

```ts
// Before — plugin-katex as a pipeline plugin
import { katex } from "@streamd/plugin-katex";
const katexPlugin = katex({ throwOnError: false });
renderHtml(tokens, { plugins: [katexPlugin], allowDangerousMetaHtml: true });

// After — component override calling KaTeX directly
import katex from "katex";
renderHtml(tokens, {
  components: {
    math_block: (token) =>
      `<div class="math-display">${katex.renderToString(token.content, { displayMode: true })}</div>`,
    math_inline: (token) =>
      katex.renderToString(token.content, { displayMode: false }),
  },
});
```

See `docs/migration/0004-plugin-katex-removed.md` for per-renderer
replacement snippets (HTML, React, React Native).
