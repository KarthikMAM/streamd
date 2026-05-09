---
title: Introduction
sidebar_position: 1
slug: /
---

# streamd

**streamd** is a streaming-first markdown toolchain for TypeScript. Parse
markdown incrementally as an LLM streams tokens, render to HTML / React /
React Native, extend via plugins — all zero-dependency in the core parser
and renderers.

## Why streamd

Existing CommonMark parsers (`commonmark.js`, `markdown-it`, `marked`,
`micromark`) are batch-oriented. When you point them at an LLM response
that arrives one token at a time, the naïve approach is to re-parse the
entire accumulated document on every chunk — O(n²) over the stream.

streamd's parser keeps incremental state so per-chunk cost is
proportional to the new content only, and the renderers produce a stable
token tree that can be safely re-rendered on each chunk. For the typical
LLM-streaming case (plain text appended to an open paragraph), per-chunk
work is O(K) where K is the new byte count.

## What's in the monorepo

streamd ships as eight small, composable packages:

| Package | Purpose |
|---|---|
| [`@streamd/parser`](./packages/parser) | Core incremental CommonMark + GFM parser. Outputs a token tree, not HTML. |
| [`@streamd/tokens`](./packages/tokens) | Design tokens and light / dark themes shared by every renderer. |
| [`@streamd/html`](./packages/html) | Synchronous HTML renderer plus a streaming helper. |
| [`@streamd/react`](./packages/react) | React renderer, `<StreamdMarkdown>` component, and `useStreamingMarkdown` hook. |
| [`@streamd/react-native`](./packages/react-native) | React Native renderer with `Text` / `View` / `Pressable` primitives. |
| [`@streamd/plugins`](./packages/plugins) | Plugin pipeline with five built-ins (anchors, link attrs, highlight, sanitize, frontmatter). |
| [`@streamd/plugin-shiki`](./packages/plugin-shiki) | [Shiki](https://shiki.style/) syntax-highlighter adapter. |
| [`@streamd/cli`](./packages/cli) | `streamd` stdin → stdout binary with a programmatic API. |

## What this site contains

- **Packages** — one reference page per published package with install,
  quick-start, key APIs, and security notes.
- **Recipes** — end-to-end guides covering LLM streaming, safe pipeline
  construction, theming, component overrides, Shiki and KaTeX
  integration, and migration from `markdown-it` / `commonmark.js` /
  `marked`.
- **API reference** — TypeDoc-generated from the published `.d.ts`
  files. Available at `/api/` on the deployed site.

## Repository

Source, issues, and releases live at
[github.com/KarthikMAM/streamd](https://github.com/KarthikMAM/streamd).

## License

MIT.
