---
inclusion: always
---

# @streamd/parser — Conventions & Guardrails

Engineering standards, performance constraints, and code style conventions for `packages/parser/src/`.

## Hard Constraints

1. **Zero regex** — no `RegExp`, no regex literals, no `.match()/.test()/.replace(regex)`. All pattern matching via charCode comparisons, `Uint8Array` lookup tables, and hand-written state machines.
2. **Zero runtime dependencies** — no `dependencies` in package.json.
3. **No renderer** — parser outputs tokens only. HTML rendering is a separate package.
4. **TS strict mode** — `verbatimModuleSyntax`, `isolatedModules`, no `const enum`. Use `as const` objects.
5. **Biome compliance** — no default exports, no barrel files, `Array<T>` syntax (not `T[]`), camelCase functions, PascalCase types. Max cognitive complexity 15.
6. **~300 lines per file** — enforced modularity. Around 300 is fine; don't sacrifice readability or performance to hit an exact number.

## Performance Rules (Non-Negotiable)

### Monomorphic Object Shapes
- All internal records (`Block`, `InlineNode`, tokens) MUST be created via factory functions that initialize ALL fields in a fixed, consistent order.
- No conditional property additions. No `delete`. No post-construction shape mutations.
- Unused fields use `null`/`0`/`""` — never omitted.
- Do NOT mutate `block.kind` after creation — track consumed blocks externally (e.g., `Set<number>`).

### Dense Integer Dispatch
- Token types (0–22) and block kinds (0–11) are dense integers.
- All hot `switch` statements dispatch on numeric tags. Never use string comparison in hot paths.

### Zero-Copy in Hot Paths
- Block and inline scanners operate on `(src: string, offset: number)` pairs.
- No `src.slice()`, `src.substring()`, `src.split()` in hot scanning loops.
- Substrings materialized only in cold paths (assembly, entity lookup).

### Allocation Discipline
- **InlineNode pool**: module-level `NODE_POOL` array, never shrunk, only grown. Reused across all `parseInlines` calls.
- **Shared result objects**: inline sub-scanners mutate and return a module-level `RESULT` object. Caller reads immediately. Zero allocation per scan.
- **Shared indent result**: each block scanner file has a module-level `IND = { indent: 0, pos: 0 }` mutated by `countIndent`. Safe because each file has its own instance.
- **No closures in hot loops**. No per-character allocation in the dispatch loop.

### Iteration Discipline
- `for` loops with index variables over arrays. No `for...of` (creates iterators). No `.map()/.filter()/.reduce()` in hot paths.
- Utility functions outside hot loops may use idiomatic patterns.

### Small Hot Functions
- Character classification and skipping functions (`isAlpha`, `skipSpaces`, `isPunctuation`) MUST be ≤10 lines for JIT inlining.
- The `pushToken` helper in `inline/scan.ts` encapsulates the repeated pool-node pattern — keep it small for inlining.

### Typed Arrays
- `Uint8Array` for `CHAR_TABLE`, inline dispatch tables, and character class bitmaps.

### Line Scanning
- `findLineEndFast` uses `String.indexOf("\n")` which V8 optimizes to SIMD-accelerated search.
- CRLF is handled by checking the char before LF. Bare CR (without following LF on the same line) is a documented known limitation.

## Code Style

### No Magic Numbers
- Every charCode comparison MUST use a named `CC_*` constant from `scanner/constants.ts`.
- The only exception: Unicode Zs code points in `isUnicodeWhitespace`.
- If a new charCode is needed, add it to `constants.ts` first.

### Guard Clauses with Early Returns
- Every function should validate preconditions at the top and return early.
- Avoid deep nesting. Prefer flat control flow.
- Use `if (condition) return` over `if (condition) { ... } else { ... }`.

### No Redundant Type Annotations
- Let TypeScript infer from initializers wherever the type is obvious.

### JSDoc Standards
- Every file MUST have a module-level `/** ... @module <path> */` JSDoc.
- Every exported function MUST have a `/** ... */` JSDoc.
- Spec citations (e.g., "Spec §4.2") should be included where applicable.
- `CC_*` constants and `H_*` handler indices are self-documenting — no per-constant JSDoc needed.
- No unnecessary comments. Document *why*, not *what*.

### No Dead Code
- No unused exports. No unused imports. No unreachable branches.
- Run `tsc --noEmit` to catch unused declarations.

## Shared Utilities

### `scanner/constants.ts`
- `CC_*` for ASCII charCodes, `CF_*` for bitmask flags, `CHAR_TABLE` for the lookup table.
- `HTML_BLOCK_TAGS` and `HTML_TYPE1_TAGS` — tag name sets for HTML block detection.

### `scanner/utils.ts`
- `isAlpha`, `isAsciiWhitespace`, `isPunctuation`, `isUnicodeWhitespace` — character classification.
- `skipSpaces` — whitespace skipping.
- If you need a character classification function, check here first. Do NOT duplicate.

### `scanner/block/utils.ts`
- `findLineEndFast`, `nextLine` — line boundary scanning (SIMD-accelerated).
- `countIndent` — fused indent measurement with tab expansion.
- `isBlankRange`, `isSpaceOrTab` — range/char checks.

### `utils/token-factory.ts`
- One factory function per token type. All fields initialized in fixed order.
- Never construct token objects inline — always use the factory.

## Testing Standards

### Direct Imports
- Each test file MUST directly import the function(s) under test from the corresponding source module.
- Tests should NOT go through `parse()` unless they are integration tests in `index.test.ts`.

### Single Responsibility
- Each test tests exactly one scenario with one assertion focus.

### Meaningful Assertions
- No dummy tests. Every test must assert specific behavioral outcomes with concrete expected values.
- Use `toBe` for primitives, `toEqual` for objects, `toBeNull`/`not.toBeNull` for nullability.

### Test File Naming
- Each source file `foo.ts` has a corresponding `foo.test.ts` in the same directory.
- Integration tests go in `index.test.ts`.

### Coverage Target
- 95%+ statement coverage, 85%+ branch coverage via vitest + v8 provider.
- Type-only files (`internal.ts`, `options.ts`, `tokens.ts`) are excluded from coverage.

## Architecture

### Flat Scan-to-Completion
- `scanBlocks` classifies each block by its first line, dispatches to a type-specific scanner that consumes the entire block in a tight loop.
- Produces a flat `Array<Block>` — no tree, no open stack.
- Container blocks (blockquotes, lists) store content ranges and are recursively re-parsed during assembly.

### Inline Dispatch Table
- `Uint8Array(128)` maps ASCII charCodes to handler indices (defined in `inline/dispatch.ts`).
- `dispatch[code] === 0` means text — the fast path.
- Lazily cached per `(math, autolinks, strikethrough)` combination (3-bit key, up to 8 variants).

### Assembly
- `extractAllLinkRefDefs` scans paragraphs for link ref defs, returns a `Set<number>` of consumed block indices (does NOT mutate `block.kind`).
- `assembleBlock` dispatches on `BlockKind` integer to produce tokens.
- Container assembly (`assembleBlockquote`) re-scans inner content with `scanBlocks` recursively, with a 100-level nesting depth guard.

### Streaming
- Streaming logic lives in `streaming/` module: `state.ts`, `fast-path.ts`, `incremental.ts`.
- `StreamState` tracks previous source length, options, cached completed tokens/refMap, and active block metadata (kind, content start, fence info, cached inlines).
- Caller passes the full accumulated source each time. Parser diffs against `prevLen` to detect new content, then applies fast paths or falls back to scanning the active block region.
- Fast paths (checked in order): text-append O(K), fenced code O(K), math block O(K), paragraph continuation O(K)+O(N) inlines, full scan.
- Completed blocks are promoted and cached; only the last (active) block is re-assembled speculatively.
- No flush needed — the last call's tokens are final.
- `stableCount = completedTokens.length` (last block is speculative).

### GFM Options Resolution
- `gfm: true` enables `tables`, `strikethrough`, `taskListItems`, `autolinks` unless individually overridden.
- Options resolved once in `resolveOptions`, threaded as `AssembleOpts`.

### Pathological Input Protection
- Code span backtick max: 32
- Table max columns: 128
- Max nesting depth: 100 (enforced in `assembleBlockquote`)
- Ordered list marker: max 9 digits (spec §5.2)
- Delimiter resolution: opener-bottom tracking prevents O(n²)
