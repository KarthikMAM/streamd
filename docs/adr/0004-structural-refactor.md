# ADR 0004: Structural refactor — string discriminants, component-owned rendering, streaming reveal, parser polish

**Status:** Accepted.
**Date:** 2026-05-08.
**Scope:** Every package and app in the monorepo.

---

## 1. Context

The pre-0.2 architecture coupled three concerns together:

1. Tokens dispatched on integer IDs, which made the schema cheap to
   dispatch on but opaque at the public API boundary.
2. Plugins were expected to produce HTML strings on a `meta.html`
   channel, and renderers spliced those strings verbatim when the
   consumer opted in via `allowDangerousMetaHtml`. Safety depended on
   a `sanitize-not-last` runtime ABI check.
3. The React and React-Native renderers ran plugins as middleware
   between parse and render, leaving component-level extensibility
   weaker than the plugin pipeline.

This ADR documents the architectural change that separates those
concerns and sets a harder boundary around the HTML channel: the
parser and plugins never produce HTML. Rendering owns pixels;
structure owns the token tree. Consumers who want HTML extensions
(KaTeX, arbitrary codegen) get it via component overrides — an
explicit, typed extension point — rather than an opt-in string-splice
trust flag.

Five owner constraints pinned the shape of the refactor up front:

1. **No non-spec extension tokens.** streamd does not add
   domain-specific token types (icons, ratings, widgets, embeds) to
   the core. Core token surface stays aligned with CommonMark 0.31.2
   + GFM 0.29. Third-party plugins add extensions by annotating
   existing tokens via `meta` or by wrapping consumer rendering in
   component overrides.
2. **Plugin system is retained** — but plugins return token objects,
   never HTML. HTML is never emitted by the parser and never emitted
   by a plugin. The entire `meta.html` / raw-HTML channel disappears
   from the pipeline.
3. **KaTeX / math**: the parser emits `MathBlock` / `MathInline` with
   the raw TeX content (delimiters stripped; content is the verbatim
   TeX source). Rendering is a component-layer concern.
4. **Shiki / syntax highlighting**: `plugin-shiki` survives as a
   **token-annotation plugin** — it attaches structured `ThemedSegment`
   data to `CodeBlock.meta.highlight`. It does not emit HTML. The
   renderer components read `meta.highlight` and emit styled spans
   directly.
5. **Do everything in a single go.** Sequential waves per the plan
   below, no intermediate approvals.

Four architectural shifts fall out of the constraints:

1. **String-discriminated tokens** (`type: "paragraph"` instead of
   `type: 4`), via a string-literal union. Matches the dispatch key
   the consumer sees at the API boundary to the literal value the
   parser produces.
2. **Component-owned rendering.** Every token type maps to a default
   React / React-Native component or HTML-string function. Overrides
   are supplied by consumers via a `components={}` map. The renderer
   no longer runs plugins as a middleware pipeline over pre-rendered
   HTML.
3. **Streaming reveal as an explicit UX layer** with three
   independent knobs (`granularity`, `textMode`, `animation`) plus a
   sixteen-preset animation library, lifted to a provider +
   `<Words>` component in each React renderer. The parser is
   oblivious.
4. **Parser polish**: (a) `shouldEmitSpace(prev, next)` rule set
   governing `SpaceToken` emission between blocks; (b) list-merge
   streaming quirk — when re-parsing the active region and the first
   new block is a list AND the previous completed block was also a
   list, extend the re-scan backwards to merge them.

---

## 2. Token surface — before and after

### 2.1 Removed entirely

The following tokens leave the core token set and **cannot be
re-introduced** by plugins (plugins return tokens from the core set
only):

- `HtmlBlock` (previous id 6). Source HTML blocks are consumed by the
  parser and dropped. No token is emitted. This removes an entire
  class of injection vulnerability by construction.
- `HtmlInline` (previous id 19). Same treatment as `HtmlBlock`. The
  inline scanner treats `<tag>` sequences as **literal text** (the
  `<`, `>`, and everything between them enter a `TextToken`).
  Preserves visual fidelity of malformed or accidental `<>` usage in
  streamed content without a render-time risk.
- `Softbreak` (previous id 11). A newline inside a paragraph becomes
  part of the preceding `TextToken.content` as a literal `\n`. The
  renderer collapses per CSS `white-space` as appropriate.
  `Hardbreak` remains — it is the explicit `<br>` signal.

### 2.2 String-discriminated tokens (final set of 20)

| `type` literal | Replaces integer | Fields (unchanged unless noted) |
|---|---|---|
| `"blockquote"` | 0 | `children: Token[]` |
| `"list"` | 1 | `ordered: boolean`, `start: number`, `tight: boolean`, `children: ListItemToken[]` |
| `"list_item"` | 2 | `checked: boolean \| null`, `children: Token[]` |
| `"heading"` | 3 | `level: 1..6`, `children: InlineToken[]` |
| `"paragraph"` | 4 | `children: InlineToken[]` |
| `"code_block"` | 5 | **`lang: string`**, **`content: string`** (`info` field removed — collapsed into `lang`) |
| `"hr"` | 7 | — |
| `"space"` | 8 | — |
| `"table"` | 9 | `align: Align[]`, `head: InlineToken[][]`, `rows: InlineToken[][][]` |
| `"text"` | 10 | `content: string` |
| `"hardbreak"` | 12 | — |
| `"code_span"` | 13 | `content: string` |
| `"em"` | 14 | `children: InlineToken[]` |
| `"strong"` | 15 | `children: InlineToken[]` |
| `"strikethrough"` | 16 | `children: InlineToken[]` |
| `"link"` | 17 | `href: string`, `title: string`, `children: InlineToken[]` |
| `"image"` | 18 | `src: string`, `alt: string`, `title: string` |
| `"escape"` | 20 | `content: string` |
| `"math_inline"` | 21 | `content: string` |
| `"math_block"` | 22 | `content: string` |

Final set is 20 tokens, not 23. `HtmlBlock`, `HtmlInline`,
`Softbreak` are gone. No new tokens are added.

`CodeBlockToken.info` is removed — `lang` now carries everything the
renderer needs. The info string's historic second-word payload
(e.g. `js filename=foo.js`) is still available to the parser during
assembly but is not exposed through the token.

### 2.3 `TokenMeta` — no more `html`

```ts
export interface TokenMeta {
  /** `id` attribute (headingAnchors populates). */
  readonly id?: string;
  /** Extra class tokens (space-joined). */
  readonly className?: string;
  /** `rel` attribute (links only). */
  readonly rel?: string;
  /** `target` attribute (links only). */
  readonly target?: string;
  /** Arbitrary safe attributes. */
  readonly attrs?: Readonly<Record<string, string>>;
  /** Structured syntax-highlight tokens. plugin-shiki populates. */
  readonly highlight?: HighlightData;
  /** Parsed frontmatter attached to the first paragraph, if any. */
  readonly frontmatter?: Readonly<Record<string, unknown>>;
}

export interface HighlightData {
  /** Array of lines, each an array of themed segments. */
  readonly lines: ReadonlyArray<ReadonlyArray<ThemedSegment>>;
  /** Detected language (may differ from token.lang on fallback). */
  readonly lang: string;
  /** Theme key (light / dark / custom). */
  readonly theme: string;
}

export interface ThemedSegment {
  readonly text: string;
  readonly color?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
}
```

No `html?: string`. No way for a plugin to splice raw HTML. Renderers
that receive `meta.highlight` emit styled `<span>` / `<Text>` trees
directly.

### 2.4 `TOKEN_SCHEMA_VERSION` bumps to `2`

The removal of three tokens, the string-discriminant switch, and
`meta.html` removal are all breaking. Bump `TOKEN_SCHEMA_VERSION`
from `1` to `2`. The mandatory `Plugin.requires.tokenSchema` ABI
check stays — any plugin built against schema 1 throws
`StreamdPluginAbiError { kind: "token-schema-mismatch" }`.

### 2.5 `allowDangerousMetaHtml` — deleted

The prop, the CLI flag, the sanitize-last ABI check (`kind:
"sanitize-not-last"`) — all removed. With no HTML tokens and no
`meta.html`, there is nothing dangerous for the flag to gate. The
error class `StreamdPluginAbiError` keeps the remaining kinds
(`missing-requires`, `token-schema-mismatch`) only.

---

## 3. Plugin model — pure token transforms

### 3.1 The contract

```ts
type Plugin = {
  readonly name: string;
  readonly requires: { tokenSchema: 2 };
  readonly transform: (tokens: TokensList, ctx: PluginContext) => TokensList;
};
```

A plugin's `transform` takes tokens, returns tokens. It may:

- Annotate tokens via `meta` (typed fields only — see §2.3).
- Drop tokens (e.g., empty paragraphs).
- Rewrite tokens (e.g., sanitize dangerous `href` values).
- Split / merge adjacent tokens.

A plugin **may not**:

- Return `meta.html`. The field does not exist.
- Return a token type outside the core set of 20.
- Rely on `allowDangerousMetaHtml` or any other trust flag.

### 3.2 The five built-ins — final shape

- `sanitize()` — URL-scheme check on `Link.href` and `Image.src`
  against the allowlist (`http`, `https`, `mailto`, `tel`, `ftp`).
  Unsafe schemes rewrite `href` to `#` (configurable). Also filters
  `meta.attrs` keys through `SAFE_ATTR_ALLOWLIST`. **No longer
  required to be last** — no HTML tokens exist. Position is a pure
  preference concern.
- `headingAnchors()` — sets `Heading.meta.id` based on a slug derived
  from the flattened inline children.
- `linkAttributes()` — sets `Link.meta.rel` and `Link.meta.target`
  based on internal/external classification.
- `highlightCode()` — deprecated wrapper that delegates to whichever
  highlighter is configured. Implementation now attaches structured
  `meta.highlight` (not HTML). Default no-op; supply a `HighlightFn`
  that returns `HighlightData`. Kept for API continuity.
- `frontmatter()` — extracts leading YAML/TOML, attaches parsed data
  to the first token's `meta.frontmatter`.

### 3.3 Plugin ABI — simplified errors

```ts
type StreamdPluginAbiErrorKind = "missing-requires" | "token-schema-mismatch";
```

The `sanitize-not-last` kind is removed. Consumer code that catches
this specific kind needs to drop the case.

---

## 4. Parser changes

### 4.1 `token-type.ts` → string constants

```ts
export const TokenType = {
  Blockquote: "blockquote",
  List: "list",
  ListItem: "list_item",
  Heading: "heading",
  Paragraph: "paragraph",
  CodeBlock: "code_block",
  Hr: "hr",
  Space: "space",
  Table: "table",
  Text: "text",
  Hardbreak: "hardbreak",
  CodeSpan: "code_span",
  Em: "em",
  Strong: "strong",
  Strikethrough: "strikethrough",
  Link: "link",
  Image: "image",
  Escape: "escape",
  MathInline: "math_inline",
  MathBlock: "math_block",
} as const;

export type TokenTypeValue = (typeof TokenType)[keyof typeof TokenType];
```

Every `switch` in the parser, assembler, streaming path, and
renderers dispatches on these string literals. V8 interns short
literal strings and compares them by pointer equality; the hot-path
cost is within noise of integer comparison for modern engines.

### 4.2 HTML block scanner — deleted

Delete `packages/parser/src/scanner/block/html.ts` entirely. The
block dispatcher's `<` branch is removed. The inline dispatcher's
`<` handler (`html.ts`) is reduced to: emit the literal `<` into
the current `TextToken`, consume `>` similarly. No inline HTML
scanner survives. The tag allowlists (`HTML_BLOCK_TAGS`,
`HTML_TYPE1_TAGS`) in `scanner/constants.ts` are removed.

### 4.3 Softbreak — inlined into `TextToken`

The inline scanner's newline handler no longer emits a
`SoftbreakToken`. It appends `\n` to the last `TextToken` being
built (or starts a new `TextToken` if none is pending). `Hardbreak`
still emits its own token.

### 4.4 `CodeBlock.info` → absorbed into `lang`

The fenced code scanner parses the info string, stores the full
string for internal use (language detection, later extensions), but
the emitted `CodeBlockToken` carries only `lang: string` and
`content: string`. The `info` field on the token is removed.

### 4.5 `shouldEmitSpace(prev, next)` rule set

New function in `packages/parser/src/assembler/space-rules.ts`:

```ts
export function shouldEmitSpace(prev: Token | null, next: Token | null): boolean {
  if (!prev || !next) return false;
  const p = prev.type;
  const n = next.type;
  if (p === "heading" && n !== "hr") return false;
  if (p === "table") return false;
  if (p === "paragraph" && n === "list") return false;
  if (p === "paragraph" && n === "table") return false;
  if (p === "list" && n === "list") return false;
  return true;
}
```

The top-level assembler loop calls this on every
`(completedBlock, nextBlock)` pair and emits a `SpaceToken` between
them only when the rule returns true. Removes the renderer's
reliance on CSS margin-collapse to deduplicate vertical whitespace
between adjacent blocks.

### 4.6 List-merge streaming quirk

New guard in `streaming/incremental.ts::reparseActiveRegion`:

```ts
const firstNewBlock = /* classify first block at state.activeBlockStart */;
const lastCompleted = state.completedTokens[state.completedTokens.length - 1];
if (firstNewBlock?.type === "list" && lastCompleted?.type === "list") {
  // walk completedTokens backward, drop trailing list + space groups,
  // move scanStart back to the previous list's startOffset, rebuild flat cache
}
```

Tests: verify `streamWithSnapshots` produces a single `ListToken`
when two list items arrive in separate chunks.

### 4.7 `stableCount` — retained

Non-React consumers (`@streamd/html`, `@streamd/cli`, SSR) depend on
`stableCount`. An implicit model (where the speculative-tail
property falls out of React's reconciliation via `React.memo`) only
works for React consumers; we have three renderers, one of which
emits HTML strings. Keep the explicit contract.

### 4.8 Known limitations — added / resolved

| Limitation | Status |
|---|---|
| Raw HTML block / inline pass-through | **Removed by deletion** — no HTML token exists. |
| Softbreak as distinct token | **Removed by collapse into Text.** |
| List-merge across streaming chunks | **Fixed** (§4.6). |

---

## 5. Renderer changes

All three renderer packages (`@streamd/html`, `@streamd/react`,
`@streamd/react-native`) adopt the same architectural shape:

- One default component per token type. Tables, lists, blockquotes,
  headings, code blocks, math blocks, paragraphs, emphasis, strong,
  strikethrough, code spans, links, images, breaks, escapes, text.
- A consumer-facing `components` override map: pass
  `components={{ code_block: MyCodeBlock }}` to swap one or more.
  Keys are snake_case across all three renderers, matching the
  `TokenTypeValue` string literals.
- No plugin pipeline as middleware between parse and render.
  Consumers that want plugin transforms call `applyPlugins(tokens,
  [...])` before passing tokens to the renderer (documented).
- No `allowDangerousMetaHtml`, no `meta.html` splice.
- `meta.highlight` on a `code_block` renders as styled spans /
  `<Text>` trees via the default `CodeBlock` component.
- Math is rendered as raw TeX in a `<code>` / `<Text>` by default.
  Consumers wire in KaTeX by overriding `components.math_block` /
  `components.math_inline` with a component that calls KaTeX.

### 5.1 `@streamd/html`

- `renderHtml(tokens, opts?)` stays the public entry point.
- `opts.components` is a new field: a map of token type to a
  string-returning function `(token, ctx) => string`. Used for
  overrides.
- The built-in "component" functions produce the default HTML shape
  for each token type. `CodeBlock`'s default function checks
  `meta.highlight` and emits a `<pre><code>` with styled `<span>`
  children; otherwise plain `<pre><code>` with escaped content.
- `allowDangerousMetaHtml` is not part of the API.
- `streamHtml(src, state, opts?)` keeps the same API; the
  `allowDangerousMetaHtml` field is no longer recognised.

### 5.2 `@streamd/react`

- `<StreamdMarkdown tokens components={} />` — default components
  supplied, consumer overrides by key.
- New `<MemoBlock>` wrapper that memoises on block-token identity.
  Leverages the parser's reference-stable `completedTokens` array.
- Streaming reveal provider + hook (see §6).
- No `allowDangerousMetaHtml` prop.
- `useStreamingMarkdown` keeps the same hook API, threaded through
  to the default renderer.

### 5.3 `@streamd/react-native`

- `<StreamdMarkdownNative tokens components={} />`.
- Platform-split components where native and web diverge (animation
  backend, syntax-highlight rendering).
- Streaming reveal via core `Animated` API on native, CSS keyframes
  on web.
- No `allowDangerousMetaHtml`.

### 5.4 Component override contract (shared across renderers)

```ts
type ComponentOverrides<ElementT> = {
  [K in TokenTypeValue]?: (token: TokenByType<K>, ctx: RenderContext) => ElementT;
};
```

`ElementT` is `string` for `@streamd/html`, `ReactNode` for the
React renderers. The contract is symmetric across all three
renderers.

---

## 6. Streaming reveal — new UX layer

A reveal animation layer is an explicit UX concern, not an emergent
parser property. The parser decides when tokens are finalised
(`stableCount`); the renderer decides when content appears on
screen.

### 6.1 Three orthogonal knobs

```ts
export interface StreamingRevealConfig {
  isStreaming: boolean;
  granularity: "char" | "word" | "line" | "sentence" | "chunk";
  textMode: "smoothed" | "source" | "adaptive" | "raw";
  animation: StreamingAnimationPreset;
}
```

### 6.2 Sixteen animation presets

```
fade | fade-up | fade-down | slide-in-left | slide-in-right |
slide-up | slide-down | scale-up | scale-down | blur |
blur-fade | blur-up | typewriter | shimmer | ripple | none
```

Each preset is `{ initial, animate }` keyframes — core `Animated`
shared values on native, CSS variables + keyframes on web.

### 6.3 API surface

Live in a new subpath `@streamd/react/streaming` and
`@streamd/react-native/streaming`:

```ts
export { StreamingRevealProvider } from "./streaming/provider";
export { Words } from "./streaming/words";
export { useShouldStream } from "./streaming/use-should-stream";
```

The default `TextToken` renderer delegates to
`<Words text={content} />`. Non-text tokens render instantly. Only
inline text content staggers.

### 6.4 No parser coupling

The parser knows nothing about this layer. `stableCount` is still
the finality signal; reveal animation is driven by render timing,
not parser state.

---

## 7. Package-by-package task list — six waves

Each wave runs through `spawn_sub_agents` with one agent per
package (or two for closely-coupled packages). Each sub-agent
gets this ADR as the contract + a wave-specific prompt.

### Wave 1 — parser (solo agent)

- Switch `TokenType` to string literals.
- Delete `HtmlBlock`, `HtmlInline`, `Softbreak` token interfaces +
  all scanner / assembler code that produces them.
- Collapse `CodeBlock.info` into `lang` (remove `info` field).
- Implement `shouldEmitSpace(prev, next)` and wire into assembler.
- Implement list-merge streaming quirk.
- Bump `TOKEN_SCHEMA_VERSION` to `2`.
- Remove `TokenMeta.html`, add `TokenMeta.highlight`,
  `TokenMeta.frontmatter`.
- Update every test to string discriminants. Delete HTML-block
  conformance tests. Add space-emission tests. Add list-merge
  streaming test.
- Build, lint, typecheck, test must pass green.

### Wave 2 — plugins + plugin-shiki + plugin-katex (3 parallel agents)

- **plugins**: drop `sanitize-not-last` ABI error kind. Rewrite
  `sanitize()` as URL-scheme + safe-attrs only. Rewrite
  `highlightCode()` to annotate `meta.highlight` (structured, not
  HTML). Keep `headingAnchors`, `linkAttributes`, `frontmatter`
  substantially unchanged (they already annotate `meta`).
- **plugin-shiki**: rewrite factory to return a plugin that
  annotates `CodeBlock.meta.highlight` with `HighlightData`. Drop
  HTML-emitting path entirely.
- **plugin-katex**: delete the package. Math rendering is a
  component-layer concern — consumers pass a custom
  `math_block` / `math_inline` component to the renderer that calls
  KaTeX directly against `token.content`.
- Update tests, build, lint, typecheck.

### Wave 3 — html + react + react-native (3 parallel agents)

Each renderer package:
- Adopt string-discriminated dispatch.
- Default component per token type.
- `components` override prop.
- Remove `allowDangerousMetaHtml`.
- Render `meta.highlight` as styled spans / `<Text>`.
- Default math renderers emit raw TeX as `<code>` / monospace
  `<Text>` (consumers override for KaTeX).
- Implement `MemoBlock` in the React pair (memoise by token identity).
- Wire in streaming reveal layer (React and React-Native).
- Update all tests to the new shape. Delete HTML-block tests.
  Delete `allowDangerousMetaHtml` tests.

### Wave 4 — cli + tokens (2 parallel agents)

- **cli**: remove `--allow-dangerous-meta-html`. Update streaming
  mode tests. Update help output.
- **tokens**: inspect for dependency on the removed features. Likely
  minor or no changes.

### Wave 5 — spec + bench + e2e (3 parallel agents)

- **spec**: update harness for new token shape. Pin the
  `HtmlBlock`/`HtmlInline`/`Softbreak` conformance fixtures with
  `documented-limitation` classification (they fail by design).
- **bench**: update to new API. Regenerate `baseline.json`.
  Threshold policy unchanged.
- **e2e**: update cross-renderer equivalence tests. Add
  streaming-reveal e2e coverage (basic: reveal fires on each chunk,
  animation class applied to new words).

### Wave 6 — demos (3 parallel agents)

- `apps/html-demo`, `apps/react-demo`, `apps/react-native-demo`:
  update imports, remove `allowDangerousMetaHtml`, demonstrate the
  new component-override slot, demonstrate streaming reveal with a
  couple of presets.

### Post-waves — orchestrator verification

- `npm run ci` full monorepo pass.
- `npm run check:perf` regenerates and commits.
- `npm run check:spec` passes with updated skip list.
- README + per-package READMEs updated to reflect the new API.
- CHANGELOG entry drafted for the 0.2 version bump.

---

## 8. Non-goals

- Integer-discriminant performance recapture. Benchmarks may show a
  small regression from the string switch. Accept it; the V8 intern
  + pointer-equality cost is within noise for real inputs.
- Custom non-spec extension tokens. Not being added to the core.
  Consumers that want domain-specific token types (icons, ratings,
  widgets, embeds) build them via a plugin that annotates existing
  tokens' `meta`, or via a component override that interprets
  `Text` / `CodeSpan` / `Link` content at render time.
- Per-platform `.web.tsx` split within `@streamd/react-native`
  beyond what already exists for math / code. Done where divergence
  exists; not imposed for symmetry alone.
