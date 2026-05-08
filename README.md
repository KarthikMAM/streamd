# streamd

[![CI](https://github.com/KarthikMAM/streamd/actions/workflows/ci.yml/badge.svg)](https://github.com/KarthikMAM/streamd/actions/workflows/ci.yml)
[![Release](https://github.com/KarthikMAM/streamd/actions/workflows/release.yml/badge.svg)](https://github.com/KarthikMAM/streamd/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](.nvmrc)

Streaming-first markdown toolchain. Parse markdown incrementally as LLM
tokens arrive, render to HTML / React / React Native, extend via
plugins — all zero runtime dependencies and written in TypeScript.

## What is streamd?

streamd is a monorepo of small packages that share a single design
premise: the markdown arriving from an LLM is *a live stream*, not a
finished document. The parser keeps per-stream state so each new chunk
costs work proportional to the new content plus the active tail block,
not the accumulated source length. Renderers consume the resulting
token tree and are safe to call on every chunk — no partial-DOM
shredding, no re-rendered flicker.

Every popular CommonMark implementation today (`commonmark`,
`markdown-it`, `marked`, and `micromark`) is batch-oriented. Point any
of them at an LLM response arriving token by token and the naive
recipe — re-parse the whole accumulated document on every chunk — is
O(n²) over the stream. `micromark` in particular exposes a Node.js
`Duplex` but buffers chunks internally and only emits HTML on `end()`,
so it does not help the streaming render loop. streamd's parser was
written from scratch to fit this use case: a dispatch-table inline
scanner, a flat block scanner with a fast-path cascade for paragraph
and fenced-code continuations, and a single opaque `ParserState` that
the caller threads back in on every call.

Beyond the parser, the rest of the monorepo is the shortest path from
token tree to pixels: a synchronous HTML renderer, a React renderer
with a streaming hook, a React Native renderer with the same streaming
hook, design tokens for light / dark themes, a five-plugin pipeline
with a mandatory ABI check, first-party Shiki and KaTeX adapters, and
a `streamd` CLI that glues everything together for stdin/stdout use.

## Packages

| Package | Purpose |
|---|---|
| [`@streamd/parser`](packages/parser) | Core incremental CommonMark + GFM parser |
| [`@streamd/tokens`](packages/tokens) | Design tokens + light / dark themes + shared error root |
| [`@streamd/html`](packages/html) | HTML renderer + streaming helper + theme stylesheet generator |
| [`@streamd/react`](packages/react) | React renderer with `<StreamdMarkdown>` + `useStreamingMarkdown` hook |
| [`@streamd/react-native`](packages/react-native) | React Native renderer with `<StreamdMarkdownNative>` + `useStreamingMarkdown` hook |
| [`@streamd/plugins`](packages/plugins) | Plugin pipeline with five built-ins (`sanitize`, `headingAnchors`, `linkAttributes`, `highlightCode`, `frontmatter`) and a mandatory ABI check |
| [`@streamd/plugin-shiki`](packages/plugin-shiki) | [Shiki](https://shiki.style/) syntax-highlighter adapter — async factory, emits `meta.html` |
| [`@streamd/cli`](packages/cli) | `streamd` CLI — stream stdin through parse + render + plugins to stdout |

Demos live in [`apps/html-demo`](apps/html-demo),
[`apps/react-demo`](apps/react-demo), and
[`apps/react-native-demo`](apps/react-native-demo). Internal workspaces
not published to npm: [`@streamd/spec`](packages/spec) (CommonMark +
GFM conformance harness), [`@streamd/bench`](packages/bench) (perf
baseline), [`@streamd/e2e`](packages/e2e) (cross-renderer equivalence
and fuzzer).

## Install

Pick the renderer you need — every renderer peer-depends on the parser.

```bash
# HTML (server or browser)
npm install @streamd/parser @streamd/html

# React
npm install @streamd/parser @streamd/react @streamd/tokens

# React Native (or react-native-web)
npm install @streamd/parser @streamd/react-native @streamd/tokens
```

Optional adapters:

```bash
npm install @streamd/plugins @streamd/plugin-shiki shiki
npm install -g @streamd/cli
```

## Quick start

### One-shot parse + render

```ts
import { parse } from "@streamd/parser";
import { renderHtml } from "@streamd/html";

const { tokens } = parse("# hello **world**");
console.log(renderHtml(tokens));
// => "<h1>hello <strong>world</strong></h1>\n"
```

### Streaming parse (the LLM case)

```ts
import { streamHtml } from "@streamd/html";

let state = null;
let accumulated = "";

for await (const chunk of llmStream) {
  accumulated += chunk;
  const result = streamHtml(accumulated, state, { parse: { gfm: true } });
  state = result.state;
  updateDom(result.html);
}
```

`streamHtml` re-renders HTML for the full accumulated source on every
call, but the parser only re-scans the new content plus the active
tail block — the renderer call is linear in the token count, the
parser call is proportional to the new chunk.

### React hook

```tsx
import { StreamdMarkdown, useStreamingMarkdown } from "@streamd/react";

export function LiveResponse() {
  const { tokens, append } = useStreamingMarkdown("", { gfm: true });

  useEffect(() => {
    const socket = openLLMSocket();
    socket.onMessage((chunk) => append(chunk));
    return () => socket.close();
  }, [append]);

  return <StreamdMarkdown tokens={tokens} />;
}
```

`@streamd/react-native` exposes the identical `useStreamingMarkdown`
hook with the same signature, paired with `<StreamdMarkdownNative>`.

### Plugins + adapters

```ts
import { parse } from "@streamd/parser";
import { renderHtml } from "@streamd/html";
import { headingAnchors, linkAttributes, sanitize } from "@streamd/plugins";
import { shiki } from "@streamd/plugin-shiki";

// Shiki init is async — do it once at startup and reuse.
const shikiPlugin = await shiki({
  themes: { light: "github-light", dark: "github-dark" },
  langs: ["typescript", "bash"],
});

const { tokens } = parse(userMarkdown, null, { gfm: true });
const html = renderHtml(tokens, {
  plugins: [shikiPlugin, headingAnchors(), linkAttributes(), sanitize()],
  // Required opt-in: lets the renderer splice Shiki's pre-rendered
  // `meta.html` verbatim. Leave `false` (default) for untrusted plugins.
  allowDangerousMetaHtml: true,
});
```

Both [`@streamd/plugin-shiki`](packages/plugin-shiki) and custom math
component overrides (see [Math rendering](#math-rendering) below)
demonstrate the extension points. `plugin-shiki` writes pre-rendered
HTML to `token.meta.html`. Renderers ignore that field unless
`allowDangerousMetaHtml: true` is set — see the
[Security model](#security-model) below for the full contract.

### CLI

```bash
npm install -g @streamd/cli
echo '# hello **world**' | streamd
# => <h1>hello <strong>world</strong></h1>

# Stream LLM output incrementally — delta mode emits additive diffs
# on each chunk, ideal for a DOM buffer that replaces the tail.
llm chat --stream | streamd --gfm --stream delta

# Render a file with a dark theme and scoped CSS classes:
streamd --theme dark --class-prefix md --wrap-root < input.md > output.html
```

See [`@streamd/cli`](packages/cli) for the full flag reference,
streaming modes, exit codes, and security notes.

### Math rendering

The parser emits `MathBlock` / `MathInline` tokens with raw TeX as
`content` when `math: true` is set. Rendering is a component-layer
concern — supply a custom component override that calls KaTeX:

```ts
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import katex from "katex";

const { tokens } = parse(markdown, null, { math: true });

const html = renderHtml(tokens, {
  components: {
    math_block: (token) =>
      `<div class="math-display">${katex.renderToString(token.content, { displayMode: true })}</div>`,
    math_inline: (token) =>
      katex.renderToString(token.content, { displayMode: false }),
  },
});
```

No plugin needed — the consumer calls KaTeX directly against
`token.content`. This keeps HTML emission as an explicit consumer
choice rather than a plugin concern.

## Security model

streamd takes three orthogonal precautions against HTML-injection
classes of bugs. All three are enforced at the library boundary — not
at documentation-read time.

### 1. `sanitize()` must be last in the plugin pipeline

`@streamd/plugins`' `sanitize()`:

- drops `HtmlBlock` / `HtmlInline` tokens (raw HTML never reaches the
  renderer),
- rewrites `Link.href` / `Image.src` schemes to a safe allowlist
  (`http:`, `https:`, `mailto:`, `tel:`, `ftp:`),
- strips `token.meta.html` unless `allowRawHtml: true` is explicitly
  set,
- filters `token.meta.attrs` keys through the shared
  [`isSafeAttributeName`](packages/plugins/src/builtins/safe-attrs.ts)
  allowlist (`class`, `id`, `title`, `alt`, `lang`, `dir`, `role`,
  `href`, `src`, plus the `data-*` / `aria-*` prefix families).

`applyPlugins` throws `StreamdPluginAbiError` (`kind:
"sanitize-not-last"`) at load time if any plugin appears after
`sanitize()`. A plugin placed after the sanitizer could re-introduce
raw HTML or reinstate stripped attributes, so the pipeline order is a
contract — not a hint.

### 2. `allowDangerousMetaHtml` is opt-in on every renderer

Some plugins (`highlightCode`, `@streamd/plugin-shiki`) emit
pre-rendered HTML through `token.meta.html`. Renderers ignore this
field by default. The caller must explicitly opt in:

| Renderer | Opt-in |
|---|---|
| `@streamd/html` | `renderHtml(tokens, { allowDangerousMetaHtml: true })` |
| `@streamd/react` | `<StreamdMarkdown ... allowDangerousMetaHtml />` |
| `@streamd/react-native` | `<StreamdMarkdownNative ... allowDangerousMetaHtml />` (forwarded to custom `codeBlock` overrides only; the default RN components always ignore raw HTML) |
| `@streamd/cli` | `--allow-dangerous-meta-html` |

The flag trusts *every* plugin in the current pipeline to produce safe
HTML. Only flip it on when you control every plugin — a Shiki
integration you vetted is fine; an extension someone installed from a
config file is not.

### 3. `Plugin.requires.tokenSchema` is mandatory

Every plugin has to declare the parser token-schema version it was
compiled against:

```ts
import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import type { Plugin } from "@streamd/plugins";

export const myPlugin: Plugin = {
  name: "myPlugin",
  requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
  transform(tokens) { return tokens; },
};
```

`applyPlugins` throws `StreamdPluginAbiError` (`kind:
"missing-requires"` or `kind: "token-schema-mismatch"`) when a plugin
is missing the declaration or targets a different schema. This
converts a would-be silent corruption (stale plugin running against
new token shapes) into a loud, actionable error at pipeline-setup
time.

Reporting a vulnerability: see [`SECURITY.md`](SECURITY.md). Do not
open a public issue for a suspected security bug.

## Feature matrix

| Feature | HTML | React | React Native |
|---|:-:|:-:|:-:|
| CommonMark 0.31.2 | ✓ | ✓ | ✓ |
| GFM (tables, strike, task, autolink) | ✓ | ✓ | ✓ |
| Math (`$…$`, `$$…$$`) | ✓ | ✓ | ✓ |
| Streaming state (`parse(src, state)`) | ✓ | ✓ (`useStreamingMarkdown`) | ✓ (`useStreamingMarkdown`) |
| Theming | CSS vars via `renderThemeStylesheet` | `<ThemeProvider>` + CSS vars | `<ThemeProvider>` + StyleSheet |
| Plugins (shared pipeline) | ✓ | ✓ | ✓ |
| Syntax highlighting via adapter | ✓ (`@streamd/plugin-shiki` + `allowDangerousMetaHtml`) | ✓ (same) | ✓ via custom `codeBlock` override (same flag) |
| Math rendering via adapter | ✓ (component override calling KaTeX) | ✓ (same) | ✓ via custom `mathBlock` override |
| Accessibility attrs | `role="checkbox"` + `aria-checked` + `aria-disabled` on task items; `role="region"` + `aria-label` on code blocks | same as HTML | `accessibilityRole="header"` + `accessibilityLabel` on headings; `accessibilityRole="checkbox"` + `accessibilityState` on task items |
| Runtime input validation | `StreamdHtmlArgumentError` | `StreamdReactArgumentError` | `StreamdReactNativeArgumentError` |

## Compliance

Conformance is gated by [`@streamd/spec`](packages/spec) — every
CommonMark 0.31.2 and GFM 0.29 spec example runs on every build
through the `check:spec` npm script. The pass/fail identity of each
fixture is tracked: a run fails if any fixture that previously passed
now fails, or vice versa — pure pass-count regression is not enough.

The currently accepted divergences are pinned with classification
annotations (`documented-limitation`, `fixable`, `known-bug`,
`under-investigation`) and optional tracking-ticket URLs in
[`packages/spec/src/skip.ts`](packages/spec/src/skip.ts). Adding a
skip requires an explicit entry there so reviewers can see the exact
trade-off being accepted.

## Performance

The parser is built around three invariants that keep streaming cost
proportional to the new content rather than the accumulated document
size:

- **Text-append fast path** — chunks that are a pure plain-text
  extension of the active paragraph do O(K) work, where K is the new
  byte count.
- **Active-region rescans** — when a structural change is needed, only
  the active tail block is re-scanned, not the full document.
- **Pool reuse** — inline node pools are reused across `parseInlines`
  calls so per-chunk allocation stays flat.

The design contract, including the edge cases where paragraph
inline-reparse falls back to O(N_para), lives in
[`.kiro/steering/parser-design.md`](.kiro/steering/parser-design.md).

Concrete throughput and streaming per-chunk latency are measured and
committed as
[`packages/bench/baseline.json`](packages/bench/baseline.json) and
gated by `npm run check:perf`. The baseline currently covers parser
static throughput across mixed / paragraph-heavy / code-heavy /
pathological inputs (`static.*`) and streaming per-chunk latency on a
50 KB source at three chunk sizes (`streaming.mixed-50kb.chunk-50`,
`-200`, `-1000`).

Absolute numbers are intentionally pinned inside `baseline.json`
rather than hard-coded in this README — the file is the single source
of truth and the regression-gate policy (tolerance, fail threshold,
warn-only vs. fail-CI) lives in ADR
[0003](docs/adr/0003-performance-baseline-governance.md).

Reproduce locally:

```bash
npm run bench         # stdout comparison tables
npm run check:perf    # full regression gate — same as CI
```

Regenerate the committed baseline after an intentional improvement:

```bash
node scripts/update-perf-baseline.js
```

See [`packages/bench/README.md`](packages/bench/README.md) for the
bench harness and how to extend it.

## Development

```bash
npm install
npm run build        # turbo — all packages
npm run lint         # biome check --error-on-warnings
npm run check:banned # directives + banned names + TODO scan
npm run typecheck    # tsc --noEmit across workspaces
npm run test         # vitest
npm run check:spec   # CommonMark + GFM conformance regression guard
npm run check:perf   # throughput / latency regression gate
npm run check:links  # relative-link resolution across READMEs
npm run ci           # lint + check:banned + typecheck + build + test
```

Pre-commit hook runs `lint-staged` + `check:banned` + typecheck. See
[`STYLE.md`](STYLE.md) for the rule-to-enforcement mapping that biome,
`check:banned`, and the pre-commit gate jointly enforce.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Issue templates live under
[`.github/`](.github).

Security issues: see [`SECURITY.md`](SECURITY.md) — do not open a
public issue for a suspected vulnerability.

Release notes: monorepo-level milestones live in
[`CHANGELOG.md`](CHANGELOG.md); per-package changelogs live under
`packages/<name>/CHANGELOG.md` and are generated by Changesets on
every release.

## License

MIT — see [`LICENSE`](LICENSE).
