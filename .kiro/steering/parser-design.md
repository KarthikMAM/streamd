---
inclusion: always
---

# @streamd/parser — Design & Architecture

Reference document for the streaming markdown parser. Describes the public API, architecture, token model, file structure, and current implementation status.

## Public API

```ts
function parse(src: string, state?: ParserState | null, options?: ParseOptions): ParseResult
```

- `state` is null/undefined for full document parse, or a previous `ParserState` for streaming continuation.
- `parse("", state)` flushes all open blocks and finalizes output.
- `stableCount` indicates how many leading tokens are finalized and won't change in future chunks.
- Forward references from later chunks won't resolve in earlier emissions (documented trade-off).

### ParseOptions

```ts
interface ParseOptions {
  gfm?: boolean             // Enables tables, strikethrough, taskListItems, autolinks
  tables?: boolean           // Default: follows gfm
  strikethrough?: boolean    // Default: follows gfm
  taskListItems?: boolean    // Default: follows gfm
  autolinks?: boolean        // Default: follows gfm
  math?: boolean             // Enable $..$ inline, $$...$$ block
}
```

`gfm: true` enables all sub-features unless individually overridden to `false`.

## Spec Basis

CommonMark 0.31.2 + GFM 0.29.

## Architecture

### Flat Scan-to-Completion

Full document parsing uses a flat scan-to-completion architecture. Instead of per-line open-stack processing (the traditional CommonMark approach), each block type is consumed in a tight loop from start to finish.

**Phase 1 — Block Scanning** (`scanBlocks`):
1. Classify the first line of each block by its leading character
2. Dispatch to a block-type-specific scanner that consumes the entire block
3. Produce a flat `Array<Block>` — no tree, no open stack, no per-line container walk
4. Container blocks (blockquotes, lists) store content ranges only

**Phase 2 — Assembly** (`assemble`):
1. Extract link reference definitions from paragraph blocks (returns consumed index set)
2. Walk the flat block array, dispatch on `BlockKind` integer
3. Leaf blocks: parse inlines directly from source ranges
4. Container blocks: strip prefixes, re-scan inner content with `scanBlocks`, recurse

**Key performance characteristics:**
- `findLineEndFast` uses `String.indexOf("\n")` — V8 SIMD-accelerated
- `Block` record has ~16 fields, monomorphic shape, no dynamic arrays
- No open-stack walk per line — blocks consumed in tight loops
- Inline dispatch via `Uint8Array(128)` with bulk plain-text skip
- `NODE_POOL` reused across `parseInlines` calls (never shrunk)

### Streaming

Both full and streaming parse use the same flat architecture. Streaming accumulates source chunks and re-scans complete lines with `scanBlocks` on each chunk. The last block is speculative (may continue with the next chunk). `parse("", state)` flushes by re-scanning the full accumulated source.

### Inline Parsing

`parseInlines` scans content char-by-char via `Uint8Array(128)` dispatch table:
1. `dispatch[code] === 0` → text, bulk skip (the fast path)
2. Non-zero → switch to handler (escape, code span, delimiter, link, image, autolink, entity, newline, math, GFM autolink)
3. `resolveDelimiters` — opener-bottom tracking, linear-amortized
4. Compaction — sweep dead nodes, produce `Array<InlineToken>`

Dispatch tables defined in `inline/dispatch.ts`, lazily cached per `(math, autolinks, strikethrough)` combination (3-bit key, up to 8 variants).

### Block Rule Precedence

1. Indented code — indent >= 4
2. Math block (`$$`) — when math enabled
3. ATX heading (`#`)
4. Fenced code (`` ` `` or `~`)
5. Thematic break (`-`, `*`, `_`)
6. Blockquote (`>`)
7. Unordered list (`-`, `*`, `+` + space)
8. Ordered list (1-9 digits + `.`/`)` + space, max 9 digits per spec §5.2)
9. Table (`|` + separator on next line) — when tables enabled
10. HTML block (`<`)
11. Paragraph (with setext heading and table detection on continuation lines)

**Paragraph interruption rules:**
- Indented code cannot interrupt a paragraph (4+ indent is lazy content)

## Token Model

### Block tokens (0–9)
Blockquote, List, ListItem, Heading, Paragraph, CodeBlock, HtmlBlock, Hr, Space, Table

### Inline tokens (10–22)
Text, Softbreak, Hardbreak, CodeSpan, Em, Strong, Strikethrough, Link, Image, HtmlInline, Escape, MathInline, MathBlock

All token interfaces have ALL fields always present (monomorphic shapes).

## Internal Records

- `Block` — ~16 fields, monomorphic. Created via `createBlock`. Never mutated after scanning (consumed blocks tracked via `Set<number>` in assembler).
- `BlockKind` — dense integer block kind constants (0–11).
- `InlineNode` — first-pass inline scan output (kind: 0=token, 1=delimiter, 2=dead).
- `ScanResult` — shared interface for inline sub-scanner return values.
- `LinkReference` — stored in refMap (first definition wins).
- `NODE_POOL` — module-level `Array<InlineNode>`, never shrunk, reused across all `parseInlines` calls.
- `StreamState` — internal streaming state: accumulated source, options, last blocks, refMap.

## File Structure

```
packages/parser/src/
  types/
    token-type.ts           — TokenType as const (dense integers 0–22)
    block-type.ts           — BlockType (deprecated public API export, not used internally)
    tokens.ts               — 23 public token interfaces + Align type
    internal.ts             — InlineNode, ScanResult, LinkReference
    options.ts              — ParseOptions, ParseResult, ParserState
  scanner/
    constants.ts            — CC_* char codes, CF_* flags, CHAR_TABLE, HTML_BLOCK_TAGS, HTML_TYPE1_TAGS
    utils.ts                — isAlpha, isAsciiWhitespace, isPunctuation, isUnicodeWhitespace, skipSpaces
    block/
      types.ts              — Block, BlockKind, BlockKindValue, createBlock
      utils.ts              — findLineEndFast, nextLine, countIndent, isBlankRange, isSpaceOrTab
      scan.ts               — scanBlocks
      leaf.ts               — scanAtxHeading, scanFencedCode, scanIndentedCode, scanThematicBreak, scanHtmlBlock, scanMathBlock
      para.ts               — scanParagraph (setext heading + table detection)
      container.ts          — scanBlockquote
      list.ts               — scanList, isOrderedListStart
      html.ts               — matchHtmlBlockOpen, matchHtmlBlockClose
      table-separator.ts    — tryTableSeparator
    inline/
      dispatch.ts           — selectDispatch, H_* handler index constants
      scan.ts               — parseInlines, pushToken, NODE_POOL
      emphasis.ts           — scanDelimiterRun
      code.ts               — scanCodeSpan
      link.ts               — scanLinkOrImage
      autolink.ts           — scanAutolink, scanGfmAutolink, matchProtocolPrefix
      html.ts               — scanHtmlInline
      entity.ts             — scanEntity
      escape.ts             — scanEscape
      math.ts               — scanMathInline
  resolver/
    delimiters.ts           — resolveDelimiters
    references.ts           — scanLinkRefDef, parseLinkDestination, parseLinkTitle
  assembler/
    assemble.ts             — assemble, assembleBlock, extractAllLinkRefDefs, AssembleOpts
    container.ts            — assembleBlockquote, assembleList (with 100-level nesting guard)
    table.ts                — assembleTable
  utils/
    token-factory.ts        — 23 monomorphic factory functions
    entities.ts             — scanNamedEntity, scanNumericEntity
    normalize.ts            — normalizeLabel, unescapeString
  parser.ts                 — parse, createParser, resolveOptions, StreamState
  index.ts                  — public exports

packages/bench/                — standalone benchmark package
  src/
    index.ts                — CLI entry (--compare, --profile flags)
    generate.ts             — test input generators
    runner.ts               — bench harness (median, p95, throughput)
```

## Implementation Status

### Complete
- Flat scan-to-completion block architecture (full parse + streaming)
- All CommonMark block types: ATX/setext headings, fenced/indented code, blockquotes, lists, HTML blocks (types 1-7), thematic breaks, paragraphs, link reference definitions
- All CommonMark inline types: emphasis/strong (rule-of-three), code spans, links (inline/reference/collapsed/shortcut), images, autolinks, HTML inline, entities (numeric decoded, named as raw text), escapes, hard/soft breaks
- GFM strikethrough (`~~`, pairs of exactly 2)
- GFM task list items (`- [ ]`, `- [x]`)
- GFM extended autolinks (bare `http://`, `https://`, `www.`)
- GFM tables (pipe-delimited with alignment, max 128 columns)
- Math extension (`$..$` inline, `$$...$$` block)
- Streaming with stableCount (flat re-scan architecture)
- Options resolution (`gfm` cascades to sub-features, each independently toggleable)
- Ordered list 9-digit limit enforced (spec §5.2)
- Max nesting depth 100 for recursive container assembly
- 464 unit tests across 29 test files, 95.7% statement coverage

### Not Yet Implemented
- Conformance test harness (packages/spec wiring against CommonMark spec examples)
- HTML renderer (packages/html)
- Null byte replacement with U+FFFD (spec §2.3)

### Known Limitations
- **Bare CR before LF**: if a bare CR appears before an LF on the same line (e.g., `abc\rX\ndef`), the bare CR is not detected as a line ending. This is a spec §2.1 edge case that doesn't occur in real-world markdown. Bare CR without any LF on the line IS correctly handled.
- **Blockquote lazy continuation**: approximate — any non-blank, non-block-start line continues a blockquote, rather than only when the innermost open block is a paragraph (spec §5.1). This is a trade-off of the flat architecture.
- **Streaming O(n²)**: re-scans the full accumulated source on each chunk. Acceptable for typical streaming (LLM token-by-token) but not optimal for byte-at-a-time feeding of very large documents.
- **Named HTML entities**: emitted as raw text tokens — entity resolution is a renderer concern. Numeric entities are decoded since the code point is unambiguous.
- **Entity validation**: accepts any alphanumeric name + `;` — does not verify against the HTML5 entity list.
- **Thread safety**: module-level shared state (`NODE_POOL`, `IND`, `DISPATCH_CACHE`) means concurrent calls from multiple async contexts would corrupt each other. Single-threaded use only.

## Pathological Input Protection

| Limit | Value |
|-------|-------|
| Code span backtick max | 32 |
| Table max columns | 128 |
| Max nesting depth | 100 |
| Ordered list digits | 9 (spec §5.2) |
| Delimiter resolution | Opener-bottom tracking (linear-amortized) |

## Performance

| Input | Size | Throughput |
|-------|------|-----------|
| Mixed markdown | 1KB | ~80 MB/s |
| Mixed markdown | 50KB | ~100 MB/s |
| Mixed markdown | 500KB | ~83 MB/s |
| Pathological (`*` x 10000) | 10KB | < 0.1ms |

### Comparative (500KB mixed markdown)

| Parser | Throughput |
|--------|-----------|
| @streamd/parser | ~83 MB/s |
| commonmark.js | ~22 MB/s |
| markdown-it | ~22 MB/s |
| marked | ~14 MB/s |
