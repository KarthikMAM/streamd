---
title: Shiki syntax highlighting
sidebar_position: 5
---

# Shiki syntax highlighting

Wire [`@streamd/plugin-shiki`](../packages/plugin-shiki) end-to-end:
async factory lifecycle, `allowDangerousMetaHtml` opt-in, and safe
combinations with `sanitize()`.

## Install

```bash
npm install @streamd/plugin-shiki @streamd/parser @streamd/plugins shiki
```

## One-time init

Shiki's grammar and theme loading is async. Build the plugin once at
application startup and reuse the resolved `Plugin` on every render:

```ts
import { shiki } from "@streamd/plugin-shiki";

export const shikiPlugin = await shiki({
  themes: { light: "github-light", dark: "github-dark" },
  langs: ["typescript", "javascript", "bash", "json", "markdown"],
});
```

Pin the languages you need. Loading everything Shiki bundles adds
noticeable startup cost.

## Minimal render pipeline

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";

const { tokens } = parse(markdown);
const html = renderHtml(tokens, {
  plugins: [shikiPlugin],
  allowDangerousMetaHtml: true, // ⚠️ required for Shiki output to render
});
```

Without `allowDangerousMetaHtml: true`, the renderer ignores
`token.meta.html` (where Shiki wrote its output) and code blocks
fall back to plain `<pre><code>`. That's the intended default —
opting in is the trust decision.

## With sanitize — trusted Shiki output

```ts
import { sanitize } from "@streamd/plugins";

renderHtml(tokens, {
  plugins: [shikiPlugin, sanitize({ allowRawHtml: true })],
  allowDangerousMetaHtml: true,
});
```

`sanitize()` default-strips `meta.html`. `allowRawHtml: true` tells
it to trust the `meta.html` that earlier plugins put there.

Remember: this trusts **every** plugin running before `sanitize()`.
Don't pair `allowRawHtml: true` with a plugin you can't audit.

## With sanitize — defence in depth

```ts
renderHtml(tokens, {
  plugins: [shikiPlugin, sanitize()],
  // allowDangerousMetaHtml left false
});
```

`sanitize()` strips the Shiki output; the renderer would ignore it
anyway because `allowDangerousMetaHtml` is off. Code blocks render
as plain `<pre><code>` — safer if your threat model distrusts
Shiki's grammar files (e.g. supply-chain concern) or the plugins
between parse and sanitize.

## React

```tsx
import { useEffect, useState } from "react";
import { StreamdMarkdown } from "@streamd/react";
import { shiki } from "@streamd/plugin-shiki";
import { sanitize } from "@streamd/plugins";
import type { Plugin } from "@streamd/plugins";

export function Post({ markdown }: { markdown: string }) {
  const [plugins, setPlugins] = useState<Array<Plugin> | null>(null);

  useEffect(() => {
    let cancelled = false;
    shiki({
      themes: { light: "github-light", dark: "github-dark" },
      langs: ["typescript", "javascript", "bash"],
    }).then((shikiPlugin) => {
      if (!cancelled) {
        setPlugins([shikiPlugin, sanitize({ allowRawHtml: true })]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (plugins == null) return <div>Loading…</div>;

  return (
    <StreamdMarkdown
      source={markdown}
      plugins={plugins}
      allowDangerousMetaHtml
    />
  );
}
```

Initialise the plugin once at app startup and put it on a context if
many pages render markdown. Building it per-page is wasteful — Shiki
re-uses the highlighter instance internally, but the await churns
your React tree.

## Unknown languages

```ts
shiki({
  themes: { light: "github-light", dark: "github-dark" },
  langs: ["typescript"],
  onUnknownLang: "error", // throw on ```rust if rust isn't loaded
});
```

Options:

- `"plaintext"` (default) — highlight with Shiki's plaintext grammar.
- `"ignore"` — leave the token unchanged; the renderer emits its
  default `<pre><code>` fallback.
- `"error"` — throw `StreamdPluginShikiArgumentError` with
  `kind: "unknown-language"`. Useful in CI to catch fenced blocks
  with mistyped languages.

## Custom themes

Pass `loadTheme` for theme names not bundled with Shiki:

```ts
shiki({
  themes: { light: "my-light", dark: "my-dark" },
  loadTheme: async (name) => import(`./themes/${name}.json`),
  langs: ["typescript"],
});
```

`loadTheme` is called once per theme name in `themes`.

## CSS

Shiki's dual-theme output embeds both themes via CSS custom
properties on each `<span>`. Switch themes by toggling a class /
attribute on an ancestor:

```css
.shiki,
.shiki span {
  color: var(--shiki-light);
}

:root[data-theme="dark"] .shiki,
:root[data-theme="dark"] .shiki span {
  color: var(--shiki-dark);
}
```

See Shiki's docs for the full dual-theme CSS recipe.

## Pitfalls

- **Don't call `shiki()` in a tight loop.** It's idempotent
  (highlighter instances are cached via `cache: true` — the
  default), but each await still schedules a microtask. Hoist the
  factory call.
- **Don't mix `sanitize()` with `allowRawHtml: true` unless you trust
  every plugin before it.** See the
  [safe pipeline recipe](./sanitize-and-plugins) for the full matrix.
- **On React Native, `meta.html` can't be spliced directly into the
  view tree.** The Shiki plugin is most useful in the
  `react-native-web` case. For strictly native output, prefer a
  `CodeBlock` component override that colours inline using the
  token's content.

## Further reading

- [@streamd/plugin-shiki](../packages/plugin-shiki) — full options
  and error taxonomy.
- [@streamd/plugins](../packages/plugins#sanitize) — the sanitize
  contract.
- [Safe pipeline recipe](./sanitize-and-plugins) — decision matrix
  for `sanitize()` + `allowDangerousMetaHtml` + plugin ordering.
