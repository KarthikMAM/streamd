---
inclusion: always
---

# @streamd/parser — Design Document

## 1. Problem Statement

Render markdown in real-time as it streams from an LLM, token by token. Existing parsers (commonmark.js, markdown-it, marked, micromark) are batch-oriented — they accept a complete document and return a complete result. When used for streaming, the naive approach is to re-parse the entire accumulated document on every new token. For a 50KB response streamed in 1000 chunks, that's O(n²) total work.

We need a parser that:
- Produces a token tree (not HTML) for framework-agnostic rendering
- Supports incremental parsing where per-chunk cost is proportional to new content, not accumulated document size
- Indicates which tokens are finalized vs speculative
- Matches CommonMark 0.31.2 + GFM 0.29 compliance
- Runs in browsers and Node.js with no dependencies

## 2. Why Not Use Existing Parsers?

**commonmark.js / markdown-it / marked**: No streaming API. Must re-parse from scratch on every chunk. O(n²) total for streaming.

**micromark**: Has a Node.js Duplex stream interface, but it buffers all chunks internally and only emits the final HTML on `end()`. The state machine processes characters incrementally, but `postprocess` (subtokenize — resolving content into flow/text) and `compile` (HTML generation) are batch operations that run once at the end. There is no way to get intermediate token output. Additionally, micromark outputs HTML strings, not a token tree.

The core issue: none of these parsers were designed for the "render partial results as they arrive" use case that LLM streaming demands.

## 3. Fundamental Constraints of Incremental Markdown Parsing

Before describing our solution, it's important to understand what markdown's grammar makes theoretically possible and impossible for incremental parsing.

### 3.1 What CAN Be O(K) Per Chunk

**Literal-content blocks** (fenced code, math, HTML blocks types 1-5): Content between fences is literal text with no inline parsing. Each new line only needs to be checked for the closing delimiter — O(line_length). This is the strongest case for incremental parsing.

**Block-level continuation detection**: Determining whether a new line continues the current block or starts a new one requires checking only the first non-space character of the line — O(line_length). The set of block-start characters is fixed and small.

**Plain text append within a paragraph**: If new content contains no inline-special characters (`*`, `_`, `` ` ``, `[`, `!`, `<`, `&`, `\`, `~`, `$`, `\n`), the existing inline token tree is unchanged — just extend the last Text token's content. This is the overwhelmingly common case in LLM streaming (word-by-word output).

### 3.2 What CANNOT Be O(K) Per Chunk

**Delimiter resolution across a paragraph**: An emphasis opener `*` on line 1 might pair with a closer `*` on line 50. When the closer arrives, the resolver must scan backward through all open delimiters to find a match. The opener-bottom optimization makes this amortized O(n) over the paragraph lifetime, but a single chunk containing a closer can trigger O(D) work where D is the number of open delimiters. In practice D is small (typically 0-5), so this is effectively O(K) — but it's not guaranteed.

**Link reference forward references**: `[foo]` in paragraph 1 might resolve to `[foo]: url` defined in paragraph 100. When the definition arrives, all previous `[foo]` references retroactively become links. True incremental parsing cannot resolve these without a second pass. Our trade-off: forward references from later chunks don't resolve in earlier emissions. This is documented and acceptable for streaming — the consumer re-renders as new tokens arrive.

**Setext heading detection**: A paragraph retroactively becomes a heading when `===` or `---` appears on the next line. The paragraph token must remain speculative until the next line is seen. Our `stableCount` mechanism handles this — the last block is always speculative.

**List tight/loose detection**: Whether a list renders with `<p>` tags depends on blank lines between items, which is only known when the list ends. This affects rendering but not token structure.

### 3.3 The Honest Complexity Picture

| Scenario | Per-chunk cost | Bottleneck |
|----------|---------------|------------|
| Plain text append (no special chars) | O(K) | Dispatch table scan of new chars |
| Fenced code / math continuation | O(K) | Line scan for closing fence |
| Paragraph continuation (block check) | O(K) | First-char check of new lines |
| Paragraph continuation (inline re-parse) | O(N_para) | Full inline re-parse of paragraph |
| New closer matches old opener | O(D) amortized | Delimiter backward scan |
| Block transition (heading, code, etc.) | O(active_region) | Full scan of active block region |

Where K = new content size, N_para = current paragraph length, D = open delimiter count.

The paragraph inline re-parse is the main gap. We mitigate it with the text-append fast path (true O(K) for the common case), but when inline-special characters appear, we fall back to O(N_para). A future optimization could maintain the inline node pool across calls and only re-resolve delimiters incrementally — this would reduce the cost to O(K + D) in all cases.

## 4. Architecture

### 4.1 Why Flat Scan-to-Completion?

The traditional CommonMark approach (used by commonmark.js) maintains an "open block stack" and processes input line by line. Each line is checked against every open container block to see if it continues. This is correct but has two costs:
1. Per-line overhead proportional to container nesting depth
2. Complex mutable state that's hard to snapshot/restore for streaming

Our approach: each block type has a dedicated scanner that consumes the entire block in a tight loop. `scanBlocks` classifies the first line, dispatches to the scanner, and the scanner runs until the block ends. The output is a flat `Array<Block>` — no tree, no open stack.

**Trade-off**: This makes blockquote lazy continuation approximate. In the traditional approach, a line without `>` continues a blockquote only when the innermost open block is a paragraph. In our flat approach, any non-blank, non-block-start line continues a blockquote. This is a spec deviation (§5.1) that doesn't affect real-world markdown.

**Why this is faster**: The tight per-block loops have excellent branch prediction and cache locality. The traditional per-line approach has a branch for every open container on every line. For deeply nested blockquotes or lists, the per-line approach does O(depth) work per line; ours does O(1) per line within a block.

### 4.2 Why Pass Full Source Instead of Chunks?

Markdown blocks can span many lines. A fenced code block might start on line 1 and end on line 1000. If we received chunks, we'd need to buffer them internally anyway to re-scan the active block. By having the caller pass the full accumulated source, we:
1. Avoid internal buffering and string concatenation
2. Can use `String.indexOf` (SIMD-accelerated in V8) on the full string
3. Can diff against `prevLen` to identify new content in O(1)
4. Give the caller control over memory management

The caller is already accumulating the source (it's the LLM response). Passing it directly avoids a copy.

### 4.3 Processing Pipeline

```
Full parse:
  src → scanBlocks → Array<Block> → assemble → TokensList

Streaming parse:
  src + state → diff prevLen → fast-path cascade → TokensList + state'

Fast-path cascade (checked in order):
  1. Text append     — extend last Text token                    O(K)
  2. Fenced code     — check new lines for closing fence         O(K)
  3. Math block      — check new lines for closing $$            O(K)
  4. Paragraph cont. — skip block scan, re-parse inlines         O(K) + O(N_para)
  5. Full scan       — scanBlocks on active region               O(active_region)
```

### 4.4 Why These Fast Paths Are Safe

Each fast path has a conservative gatekeeper that can produce false negatives (fall back to full scan) but never false positives (miss a structural change). This is the key correctness invariant.

- **Text append**: `isPlainTextAppend` checks every new byte against the inline dispatch table. If ANY byte maps to a non-zero handler, we fall back. This is correct because the dispatch table is the same one `parseInlines` uses — if no byte triggers a handler, the inline parse result is guaranteed to be "existing tokens + extended last Text".

- **Fenced code**: `hasFenceClose` checks new lines for the exact closing fence pattern (indent < 4, >= fenceLen of fenceChar, then only whitespace). This mirrors the logic in `scanFencedCode`. If the check says "no close", the block is guaranteed to still be open.

- **Paragraph continuation**: `isParagraphContinuation` checks new lines for blank lines, block-start characters, and setext underlines. The block-start character set is a superset of what `isNewBlockStart` in `para.ts` checks — we're more conservative (e.g., we reject any line starting with `-` even if it's not actually a valid list marker), which means we might fall back unnecessarily but never miss a real block transition.

## 5. Critical Design Questions

### Q1: Why not a state machine like micromark?

micromark's state machine processes one character at a time with `consume`/`enter`/`exit` effects. This is elegant and spec-compliant but has costs: (1) function call per character (state transition), (2) complex construct resolution with attempt/check/interrupt, (3) no SIMD acceleration for bulk text. Our dispatch table approach processes ~80% of characters (plain text) in a tight `while` loop with no function calls, then dispatches to handlers only for special characters. Benchmarks show ~4x throughput advantage.

### Q2: Is `String.indexOf("\n")` really faster than a hand-written loop?

Yes. V8's `String.indexOf` for single-character search on one-byte strings uses SIMD instructions (SSE4.2/AVX2 on x86, NEON on ARM). A hand-written `while (src.charCodeAt(pos) !== 10) pos++` loop processes one byte per iteration. `indexOf` processes 16-32 bytes per instruction. For line scanning (the hottest operation in block parsing), this is a 10-20x speedup on the inner loop.

### Q3: What happens when the fast-path check itself becomes the bottleneck?

The text-append fast path scans every new byte against the dispatch table — O(K). For very small chunks (1-3 bytes, typical LLM tokens), this is ~3 table lookups. The overhead of the fast-path check is negligible compared to the cost it avoids (scanBlocks + parseInlines). For large chunks, the fast path is less likely to apply (more chance of special characters), so we naturally fall back to the full path which is appropriate for large inputs.

### Q4: Is the `as unknown as ParserState` cast hiding a design problem?

Yes, partially. `ParserState` is an opaque branded type in the public API to prevent consumers from constructing or inspecting it. Internally, it's a `StreamState` with concrete fields. The cast is the boundary between public opacity and internal access. An alternative would be a `WeakMap<ParserState, StreamState>` lookup, but that adds allocation and indirection on every call. The cast is zero-cost at runtime.

### Q5: What's the memory profile?

The parser holds: (1) the source string (owned by caller), (2) `completedTokens` array (grows monotonically), (3) `refMap` for link reference definitions, (4) `activeInlines` cache (replaced on each call). The `NODE_POOL` is module-level and never shrunk — it grows to the high-water mark of inline nodes in any single `parseInlines` call. For a 50KB document, typical memory overhead is ~200KB (tokens + pool). The pool is shared across all parse calls, so multiple concurrent streams would corrupt it — single-threaded use only.

### Q6: Can the streaming state grow unboundedly?

`completedTokens` grows by one token per completed block. For a document with N blocks, this is O(N) tokens. Each token is a small object (2-5 fields). For a 50KB document with ~200 blocks, this is ~200 token objects — negligible. The `refMap` grows by one entry per link reference definition — typically < 50 entries. The `NODE_POOL` is bounded by the largest paragraph's inline node count, not document size.

### Q7: Could we use a rope or gap buffer instead of string concatenation?

The caller accumulates the source via `+=` (string concatenation). In V8, this creates a ConsString (rope-like internal representation) that's flattened on first indexed access. Our `String.indexOf` and `charCodeAt` calls trigger flattening, so the effective cost is one memcpy per call. A rope data structure would avoid this copy but would prevent `indexOf` SIMD acceleration (which requires contiguous memory). The copy is O(n) but with a very small constant (memcpy is ~10GB/s). For a 50KB document, that's ~5µs — negligible compared to parsing.

### Q8: Can we achieve true O(K) for paragraph inline parsing?

Yes, with incremental delimiter tracking. The approach:
1. Persist the `NODE_POOL` state across streaming calls (currently reset each call)
2. On new content, scan only the new bytes, appending to the existing pool
3. Run delimiter resolution only on new nodes + open delimiters from previous calls
4. The opener-bottom tracking naturally prevents re-scanning committed regions

This would reduce paragraph inline cost from O(N_para) to O(K + D) where D is open delimiter count (typically 0-5). The implementation complexity is moderate — the main challenge is handling the case where a new closer matches an old opener, requiring restructuring of already-emitted tokens. This is a future optimization.

### Q9: What about concurrent/parallel parsing?

Not supported. Module-level shared state (`NODE_POOL`, `IND` objects, `DISPATCH_CACHE`) means concurrent calls corrupt each other. For the LLM streaming use case, this is fine — each stream is sequential. If concurrent parsing were needed, the shared state would need to be moved into the `StreamState` object (at the cost of per-call allocation).

### Q10: Is the paragraph inline re-parse actually a problem in practice?

For LLM streaming: usually not. LLM tokens are 1-5 bytes. The text-append fast path handles ~70-80% of tokens (plain words/spaces). When inline-special characters appear (e.g., `**bold**`), the paragraph is typically short (< 1KB) and the inline re-parse takes < 50µs. The fast path avoidance of scanBlocks (which would otherwise re-scan the entire active region) is the bigger win. The inline re-parse becomes a concern only for very long paragraphs (> 10KB) with frequent special characters — an unusual pattern in LLM output.

## 6. Module Reference

### 6.1 API Layer

| File | Lines | Role |
|------|-------|------|
| `parser.ts` | 85 | `parse`, `createParser`, options resolution. Delegates streaming to `streaming/`. |
| `index.ts` | 43 | Public re-exports. No logic. |

### 6.2 Type System

| File | Lines | Role |
|------|-------|------|
| `types/token-type.ts` | 40 | Dense integer constants 0–22 (`as const`, not `const enum`). |
| `types/tokens.ts` | 163 | 23 token interfaces. Discriminated union on `type`. All fields always present. |
| `types/options.ts` | 42 | `ParseOptions`, `ParserState` (opaque branded), `ParseResult`. |
| `types/internal.ts` | 44 | `InlineNode`, `ScanResult`, `LinkReference`. Not public. |
| `types/block-type.ts` | 30 | Deprecated public block type mapping. |

### 6.3 Block Scanning

| File | Lines | Role |
|------|-------|------|
| `scanner/block/scan.ts` | 180 | `scanBlocks` — outer dispatch loop. Classifies first char, delegates to scanners. |
| `scanner/block/leaf.ts` | 252 | ATX heading, fenced code, indented code, thematic break, HTML block, math block. |
| `scanner/block/para.ts` | 271 | Paragraph scanner with setext heading and table detection on continuation lines. |
| `scanner/block/container.ts` | 69 | Blockquote scanner — stores content range for deferred inner parsing. |
| `scanner/block/list.ts` | 143 | List scanner with ordered/unordered detection, 9-digit limit. |
| `scanner/block/html.ts` | 319 | HTML block open/close detection for types 1-7. Hand-written tag matching. |
| `scanner/block/table-separator.ts` | 80 | GFM table separator validation. Returns alignment array. Max 128 columns. |
| `scanner/block/types.ts` | 94 | `Block` record (monomorphic, ~16 fields), `BlockKind` constants, `createBlock` factory. |
| `scanner/block/utils.ts` | 94 | `findLineEndFast` (SIMD via indexOf), `nextLine`, `countIndent`, `isBlankRange`. |

### 6.4 Inline Scanning

| File | Lines | Role |
|------|-------|------|
| `scanner/inline/scan.ts` | 295 | `parseInlines` — dispatch loop + `NODE_POOL` management. Two-pass: scan then resolve. |
| `scanner/inline/dispatch.ts` | 78 | `Uint8Array(128)` dispatch table. Cached per feature-flag combination (3-bit key). |
| `scanner/inline/emphasis.ts` | 69 | `scanDelimiterRun` — `canOpen`/`canClose` classification per spec §6.2. |
| `scanner/inline/code.ts` | 111 | Code span scanner. Multi-backtick, content normalization, 32-backtick limit. |
| `scanner/inline/link.ts` | 173 | Link/image scanner. Inline, reference, collapsed, shortcut forms. |
| `scanner/inline/autolink.ts` | 308 | Spec autolinks + GFM extended autolinks. Hand-written URL validation. |
| `scanner/inline/html.ts` | 279 | Inline HTML tags, comments, PIs, CDATA, declarations. |
| `scanner/inline/entity.ts` | 47 | `&name;` and `&#decimal;`/`&#xhex;` entities. Named → raw text, numeric → decoded. |
| `scanner/inline/escape.ts` | 47 | Backslash escapes for ASCII punctuation. |
| `scanner/inline/math.ts` | 57 | `$...$` inline math. |

### 6.5 Resolution

| File | Lines | Role |
|------|-------|------|
| `resolver/delimiters.ts` | 267 | Spec §Appendix emphasis algorithm. Opener-bottom tracking. Rule-of-three. Strikethrough (pairs of 2). |
| `resolver/references.ts` | 248 | Link reference definition scanning. Destination/title parsing. Label normalization. |

### 6.6 Assembly

| File | Lines | Role |
|------|-------|------|
| `assembler/assemble.ts` | 236 | Top-level assembly. Link ref def extraction. Block dispatch. Fenced/indented code content extraction. |
| `assembler/container.ts` | 295 | Blockquote (prefix stripping + recursive re-parse, 100-depth guard). List (item parsing, tight/loose, task checkboxes). |
| `assembler/table.ts` | 114 | GFM table. Pipe-delimited cell splitting. Per-cell inline parsing. |

### 6.7 Streaming

| File | Lines | Role |
|------|-------|------|
| `streaming/state.ts` | 67 | `StreamState` interface. `createInitialState`. `resetActiveState`. |
| `streaming/fast-path.ts` | 190 | Gatekeeper functions: `isParagraphContinuation`, `isPlainTextAppend`, `hasFenceClose`, `hasMathClose`. |
| `streaming/incremental.ts` | 307 | `streamingParse` — fast-path cascade, block promotion, speculative assembly. |

### 6.8 Utilities

| File | Lines | Role |
|------|-------|------|
| `scanner/constants.ts` | 187 | `CC_*` char codes, `CF_*` flags, `CHAR_TABLE` (Uint8Array), HTML tag sets. |
| `scanner/utils.ts` | 76 | Character classification. All ≤10 lines for JIT inlining. |
| `utils/token-factory.ts` | 171 | 23 monomorphic factory functions. One hidden class per token type. |
| `utils/entities.ts` | 153 | Named/numeric entity scanning and decoding. |
| `utils/normalize.ts` | 102 | Label normalization, backslash/entity unescaping. |

## 7. Token Model

### Block Tokens (0–9)

| ID | Type | Key Fields |
|----|------|------------|
| 0 | Blockquote | children: Token[] |
| 1 | List | ordered, start, tight, children: ListItemToken[] |
| 2 | ListItem | checked: bool\|null, children: Token[] |
| 3 | Heading | level: 1-6, children: InlineToken[] |
| 4 | Paragraph | children: InlineToken[] |
| 5 | CodeBlock | lang, info, content |
| 6 | HtmlBlock | content |
| 7 | Hr | — |
| 8 | Space | — |
| 9 | Table | align[], head[][], rows[][][] |

### Inline Tokens (10–22)

| ID | Type | Key Fields |
|----|------|------------|
| 10 | Text | content |
| 11 | Softbreak | — |
| 12 | Hardbreak | — |
| 13 | CodeSpan | content |
| 14 | Em | children: InlineToken[] |
| 15 | Strong | children: InlineToken[] |
| 16 | Strikethrough | children: InlineToken[] |
| 17 | Link | href, title, children: InlineToken[] |
| 18 | Image | src, alt, title |
| 19 | HtmlInline | content |
| 20 | Escape | content |
| 21 | MathInline | content |
| 22 | MathBlock | content |

## 8. Streaming State

```ts
interface StreamState {
  prevLen: number              // Previous source length — for diff detection
  opts: AssembleOpts           // Frozen parse options
  completedTokens: Token[]     // Promoted (finalized) block tokens
  activeBlockStart: number     // Offset where the active block begins
  refMap: Map<string, LinkRef> // Accumulated link reference definitions
  activeBlockKind: BlockKind   // Kind of the last active block
  activeContentStart: number   // Content start offset (into full source)
  activeFenceChar: number      // Fence char for code/math (0 if N/A)
  activeFenceLen: number       // Fence length for code blocks (0 if N/A)
  activeLang: string           // Language for fenced code
  activeInfo: string           // Info string for fenced code
  activeInlines: InlineToken[] // Cached inlines for text-append fast path
}
```

## 9. Performance Characteristics

### Engine Optimizations Leveraged

- **V8 SIMD**: `String.indexOf("\n")` uses SSE4.2/AVX2 for 16-32 byte parallel search
- **Monomorphic ICs**: All records created via factories with fixed field order → one hidden class per type
- **JIT inlining**: Character classification functions ≤10 lines → inlined at call sites
- **Typed array indexing**: `Uint8Array` dispatch tables → bounds-checked but no boxing
- **Pool reuse**: `NODE_POOL` avoids GC pressure from inline node allocation

### Pathological Input Protection

| Limit | Value | Rationale |
|-------|-------|-----------|
| Code span backtick max | 32 | Prevents O(n²) backtick scanning |
| Table max columns | 128 | Prevents O(n) column allocation |
| Max nesting depth | 100 | Prevents stack overflow in recursive assembly |
| Ordered list digits | 9 | Spec §5.2 compliance |
| Delimiter resolution | Opener-bottom tracking | Prevents O(n²) backward scanning |

### Benchmarks

| Input | Size | Throughput |
|-------|------|-----------|
| Mixed markdown | 1 KB | ~80 MB/s |
| Mixed markdown | 50 KB | ~100 MB/s |
| Mixed markdown | 500 KB | ~83 MB/s |
| Pathological (`*` × 10000) | 10 KB | < 0.1ms |

| Parser | 500 KB Throughput |
|--------|-------------------|
| @streamd/parser | ~83 MB/s |
| commonmark.js | ~22 MB/s |
| markdown-it | ~22 MB/s |
| marked | ~14 MB/s |

## 10. Toward True O(K): Incremental Inline Architecture

This section describes how to eliminate the O(N_para) inline re-parse — the last remaining non-O(K) cost in the streaming path. This is a design proposal, not yet implemented.

### 10.1 The Bottleneck Is Redundant Work, Not a Fundamental Limitation

Nothing in markdown's grammar prevents O(K) incremental parsing for the streaming case. The consumer already handles speculative tokens — it re-renders `tokens[stableCount..]` on every chunk. The parser's job is to produce a correct token tree for the active block. The question is how much work that requires.

Currently, we re-parse ALL inlines from `contentStart` on every chunk that contains special characters. For a 10KB paragraph receiving 3-byte chunks with occasional `*`, each chunk does ~10KB of inline scanning work. Over 3000 chunks, that's 30MB of redundant scanning — re-doing work we've already done.

The redundancy has three layers:
1. **Inline scanning**: Re-scanning chars we've already classified into InlineNodes
2. **Delimiter resolution**: Re-running the opener/closer matching algorithm on nodes we've already resolved
3. **Output compaction**: Re-building the InlineToken[] array from nodes that haven't changed

All three layers can be made incremental.

### 10.2 Key Insight: Delimiter Resolution Is Already Amortized

The opener-bottom tracking in `resolveDelimiters` prevents re-scanning past previously failed positions. Each opener is visited at most once as a potential match for each closer type. Over the lifetime of a paragraph, total delimiter resolution work is O(N_para) regardless of how many chunks it arrives in.

If we persist the delimiter state across calls, the per-chunk resolution cost is O(D_new) where D_new is the number of new delimiter nodes in the chunk — typically 0-2.

### 10.3 Proposed Architecture

```
StreamState gains:
  inlinePool: InlineNode[]     // Persistent across calls (like NODE_POOL but per-stream)
  inlinePoolCount: number      // Current node count in pool
  inlineScanPos: number        // Where inline scanning left off (offset into src)
  openerBottom: {              // Persistent opener-bottom state
    star: [number, number, number]
    underscore: [number, number, number]
    tilde: [number, number, number]
  }
```

**Per-chunk flow for paragraph with special chars:**

```
1. Block check: scan new lines for block-start chars           O(K)
   → paragraph continues

2. Inline scan: scan src[inlineScanPos..lastComplete]          O(K)
   → append new InlineNodes to inlinePool
   → update inlineScanPos

3. Delimiter resolution: process new nodes only                O(D_new) amortized
   → for each new closer: backward scan from openerBottom
   → when match found: wrap tokens between opener and closer
   → update openerBottom

4. Speculative closure: produce token for the active block     O(pool_size)
   → paragraph: compact pool into InlineToken[], auto-close open delimiters
   → fenced code/math: slice content range, no inline work
   → container: re-parse inner content (rare in LLM streaming)
   → this is output assembly, not parsing — consumer iterates full array anyway
```

### 10.4 Speculative Closure of Active Blocks

The consumer needs renderable tokens for the active block even though it's not finalized. Different block types have different speculative closure costs:

**Paragraph**: Compact the inline pool into `InlineToken[]`. Unmatched openers become literal text or auto-closed emphasis (existing `autoCloseOpeners` logic). Cost: O(pool_size) — but this is output assembly. The parsing work (steps 1-3) was O(K + D_new).

**Fenced code / math**: Emit the token with content from `activeContentStart` to current position. No inline parsing. O(1) token construction + O(content_size) for the `src.slice()`. The slice is unavoidable — the consumer needs the content string.

**HTML block**: Same as fenced code — literal content, just slice and emit.

**Heading**: Headings are single-line blocks. They're completed and promoted on the same call they're detected. Never speculatively open.

**Blockquote / list (containers)**: These require re-parsing inner content for speculative closure. However, containers are rarely the active block in LLM streaming — they become completed when a blank line or block transition occurs. When they ARE active (e.g., streaming `> line1\n> line2\n> line3`), the inner content must be re-parsed on each chunk. This is O(inner_content) — not O(K). But this is inherent to containers: their token tree depends on the full inner content structure, which can change with each new line (a new inner block might start).

**The practical impact**: In LLM streaming, the active block is almost always a leaf (paragraph ~70%, fenced code ~25%, other ~5%). Containers become active only briefly during transitions. The O(inner_content) cost for container speculative closure is real but rare.

### 10.5 Dirty-Range Compaction Optimization

The O(pool_size) compaction in step 4 can be reduced. Track a `dirtyStart` index — the first pool node modified since the last compaction. Nodes before `dirtyStart` produced the same tokens as last time. Only re-compact from `dirtyStart` forward, splicing the new tokens into the cached array.

For the common case (new text appended, no delimiter matches), `dirtyStart` equals the previous pool count — we only compact the new nodes and append them. This makes compaction O(K_nodes) where K_nodes is the number of new inline nodes, not the total pool size.

When a delimiter match restructures old nodes (wrapping tokens between opener and closer), `dirtyStart` moves back to the opener position. The re-compaction covers the affected range. This is O(affected_range) — proportional to the distance between opener and closer, which is bounded by the paragraph content between them.

**Total parsing work per chunk: O(K + D_new)**. The compaction in step 4 is O(pool_size) but this is output assembly, not parsing — the consumer will iterate the full children array to render the paragraph, so this cost is matched by consumption cost.

### 10.6 Why This Works

The critical correctness property: **the active block's tokens are always speculative**. They're not in `completedTokens`. The consumer gets them as `tokens[stableCount..]` and knows they may change. So when a new closer matches an old opener and restructures the token tree, the consumer simply re-renders the speculative region — which it was going to do anyway.

The persistent opener-bottom state ensures we never re-scan past a position that already failed to match. This is the same amortization that makes batch delimiter resolution O(n) — we're just spreading it across calls.

### 10.7 Edge Cases

**Newlines in new content**: A newline produces a Softbreak or Hardbreak token. This is a new node in the pool — O(1) to create. The 2-space-before-newline check for Hardbreak is O(1).

**Code spans**: A backtick opener in chunk N might not find its closer until chunk N+100. The code span scanner needs to be made resumable — save the opener position and backtick count in state, scan forward on each new chunk. If the closer is found, replace all nodes between opener and closer with a single CodeSpan token.

**Links**: `[text](url)` spans multiple tokens. The `[` creates a potential link opener. When `]` arrives, we look ahead for `(url)` or `[ref]`. If found, wrap the inner tokens. This is similar to delimiter resolution but with different pairing rules. The link scanner would need to be made resumable.

**Link reference definitions**: These are extracted from paragraphs during assembly. In the incremental model, we'd need to check if the paragraph content so far is a link ref def prefix. This is a cold path — link ref defs are rare in LLM output.

### 10.8 Implementation Complexity

This is a moderate refactor:
1. Move `NODE_POOL` from module-level to `StreamState` (per-stream isolation)
2. Make `parseInlines` resumable — accept a start position and existing pool
3. Make `resolveDelimiters` incremental — accept persistent opener-bottom state, process only new nodes
4. Add code span and link resumability to state

The batch path (`fullParse`) would be unaffected — it creates a fresh pool and runs to completion as today.

Estimated effort: ~2-3 days for a correct implementation, ~1 week with thorough testing.

### 10.9 Is It Worth It?

For the LLM streaming use case: **probably not yet**. The text-append fast path handles ~70-80% of chunks (plain words). The paragraph continuation path handles the rest with O(N_para) inline re-parse, but N_para is typically < 1KB for LLM output. The inline re-parse for a 1KB paragraph takes ~10µs — imperceptible.

The incremental inline architecture becomes valuable when:
- Paragraphs are very long (> 10KB) — e.g., streaming a novel or long-form content
- Chunks contain frequent special characters — e.g., code-heavy markdown with lots of backticks
- Latency budget is extremely tight (< 1µs per chunk)

### 10.9 Why Not Just Speculate More Aggressively?

An alternative to incremental parsing: produce an *approximate* speculative token tree that's cheaper to compute. For example, emit unmatched `*` as literal text instead of running delimiter resolution, and only resolve when the paragraph ends.

This doesn't work because the consumer needs the correct token tree to render. If `**bold**` is emitted as five Text tokens, the user sees literal asterisks. The visual difference is jarring — it's not "speculative rendering" but "wrong rendering". The consumer's contract with `stableCount` is that speculative tokens have the correct *structure* for the content seen so far, even though that structure might change when more content arrives.

The right framing: speculative closure means "parse correctly with the content we have, knowing the result might change". It does NOT mean "parse approximately to save time". The incremental inline architecture achieves correct speculative closure with O(K) parsing work — no approximation needed.

### 10.10 Summary: The Complete O(K) Picture

With the incremental inline architecture, every streaming scenario achieves O(K) parsing work per chunk:

| Scenario | Parsing cost | Output cost | Total |
|----------|-------------|-------------|-------|
| Plain text append | O(K) dispatch scan | O(1) extend Text | O(K) |
| Fenced code / math | O(K) fence check | O(1) token construct | O(K) |
| Paragraph, no delimiters | O(K) inline scan | O(K_nodes) append | O(K) |
| Paragraph, new closer matches | O(K) scan + O(D_new) resolve | O(affected_range) re-compact | O(K + D_new) |
| Block transition | O(K) line check | O(1) promote + new block | O(K) |
| Container active (rare) | O(K) line check | O(inner) re-parse | O(inner) |

The only non-O(K) case is container speculative closure, which is inherent to containers (inner block structure can change with each line) and rare in LLM streaming (~5% of chunks, briefly during transitions).

For now, the fast-path approach provides the right trade-off: simple, correct, and fast enough for the primary use case. The incremental inline architecture is the path forward when the use case demands it.

## 11. Other Future Work

### 11.1 Conformance Test Harness

Wire `packages/spec` against the CommonMark spec examples (652 tests) and GFM spec examples. Currently at 509 unit tests with 95.7% statement coverage, but no spec conformance tracking.

### 11.2 HTML Renderer

`packages/html` — convert token tree to HTML string. Separate package per the "parser outputs tokens only" constraint.

### 11.3 Null Byte Replacement

Spec §2.3 requires replacing U+0000 with U+FFFD. Not yet implemented — low priority as null bytes don't occur in LLM output.

## 11. Known Limitations

- **Bare CR before LF**: `abc\rX\ndef` — bare CR not detected as line ending when followed by LF on the same line. Spec §2.1 edge case.
- **Blockquote lazy continuation**: Approximate — any non-blank, non-block-start line continues. Trade-off of flat architecture.
- **Named HTML entities**: Emitted as raw text. Resolution is a renderer concern.
- **Entity validation**: Accepts any `&name;` — no HTML5 entity list check.
- **Thread safety**: Module-level shared state. Single-threaded use only.
- **Forward reference resolution**: Link refs defined after their use don't resolve in earlier emissions.
- **Paragraph inline re-parse**: O(N_para) when special characters present. Mitigated by text-append fast path for the common case. See §10 for the incremental inline architecture that would eliminate this.
