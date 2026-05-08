---
"@streamd/react": minor
---

**BREAKING:** `allowDangerousMetaHtml` removed — the prop, the render option, and all `dangerouslySetInnerHTML` code paths are gone. Use component overrides for custom rendering.

**BREAKING:** `Components` interface replaced by `ReactComponents` — a token-type-keyed map (`{ [K in TokenTypeValue]?: ComponentType<{ token: TokenByType<K>; children?: ReactNode }> }`). Override any token type by passing `components={{ code_block: MyCodeBlock }}`.

**BREAKING:** `HtmlBlock`, `HtmlInline`, and `Softbreak` component slots removed — these token types no longer exist in parser schema 2.

**BREAKING:** `CodeBlockProps.info` and `CodeBlockProps.html` removed. Use `CodeBlockProps.highlight` (structured `HighlightData` from plugin-shiki) instead.

New features:
- `<MemoBlock>` wrapper memoises block-level rendering by token identity — completed blocks bail out of re-render since the parser preserves their reference across streaming calls.
- `@streamd/react/streaming` subpath added:
  - `<StreamingRevealProvider>` + `useStreamingReveal()` context hook
  - `<Words text="..." />` splits and animates text per configured granularity
  - 16 animation presets (fade, slide*, scale*, blur*, typewriter, shimmer, ripple, none)
  - `useShouldStream(tokens)` auto-detects streaming activity
- Default `CodeBlock` renders `meta.highlight` as structured styled spans (plugin-shiki integration); falls back to plain `<pre><code>` without highlight data.
- Default `MathBlock` / `MathInline` render raw TeX in `<code>`. Override `components.math_block` to call KaTeX.
