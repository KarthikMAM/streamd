/**
 * Deterministic chunking strategies for streaming-equivalence fuzzing.
 *
 * Each strategy slices an input string into a sequence of chunks whose
 * concatenation equals the original input. The choice of slice points
 * stresses the parser's streaming fast-path logic (M3 / M5 gaps in the
 * audit): one chunk per character maximizes fast-path pressure, the
 * pathological strategy splits at every known "bad" boundary so that no
 * single chunk contains a complete delimiter pair.
 *
 * ## Invariant
 *
 * For every strategy `s` and every input `src`:
 * `chunk(src, s).join("") === src`.
 *
 * The runner relies on this to reconstruct intermediate accumulator states
 * by iteratively appending chunks.
 *
 * @module fuzzer/chunk
 */

import { createRng } from "./generate";

/** Named chunk-slicing strategies. */
export type ChunkStrategy =
  | "char"
  | "word"
  | "line"
  | "fixed-n"
  | "random"
  | "unicode-boundary"
  | "pathological";

/** Configuration for a single `chunk` call. */
export interface ChunkOptions {
  readonly strategy: ChunkStrategy;
  /** Only used for `fixed-n` (byte-length window). Defaults to 8. */
  readonly n?: number;
  /** Only used for `random` / `pathological`. Defaults to 1. */
  readonly seed?: number;
}

/**
 * Slice `src` into chunks per the requested strategy.
 *
 * Returns an empty array only when `src` is empty; otherwise the returned
 * array always contains at least one element.
 *
 * @throws never
 */
export function chunk(src: string, options: ChunkOptions): ReadonlyArray<string> {
  if (src.length === 0) return [];
  const n = options.n ?? 8;
  const seed = options.seed ?? 1;
  return dispatchChunk(src, options.strategy, n, seed);
}

/**
 * Dispatch to the strategy-specific splitter. Kept separate from `chunk`
 * so the public entry point stays at cognitive-complexity 1.
 */
function dispatchChunk(
  src: string,
  strategy: ChunkStrategy,
  n: number,
  seed: number,
): ReadonlyArray<string> {
  switch (strategy) {
    case "char":
      return chunkByChar(src);
    case "word":
      return chunkByWord(src);
    case "line":
      return chunkByLine(src);
    case "fixed-n":
      return chunkByFixed(src, n);
    case "random":
      return chunkByRandom(src, seed);
    case "unicode-boundary":
      return chunkByUnicode(src);
    case "pathological":
      return chunkByPathological(src);
    default:
      throw new Error(`unknown chunk strategy: ${String(strategy)}`);
  }
}

/** One chunk per UTF-16 code unit. Worst case for the fast-path dispatch. */
function chunkByChar(src: string): ReadonlyArray<string> {
  const out: Array<string> = new Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src.charAt(i);
  return out;
}

/** Split on whitespace, preserving runs of whitespace as their own chunks. */
function chunkByWord(src: string): ReadonlyArray<string> {
  const parts = src.split(/(\s+)/);
  return parts.filter((p) => p.length > 0);
}

/** Split on `\n`, preserving the newline character on each preceding chunk. */
function chunkByLine(src: string): ReadonlyArray<string> {
  const out: Array<string> = [];
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10) {
      out.push(src.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < src.length) out.push(src.slice(start));
  return out;
}

/** Fixed-size windows (in UTF-16 code units). */
function chunkByFixed(src: string, n: number): ReadonlyArray<string> {
  const size = Math.max(1, n | 0);
  const out: Array<string> = [];
  for (let i = 0; i < src.length; i += size) out.push(src.slice(i, i + size));
  return out;
}

/** Random chunk lengths in `[1, 32]` driven by a seeded mulberry32. */
function chunkByRandom(src: string, seed: number): ReadonlyArray<string> {
  const rng = createRng(seed);
  const out: Array<string> = [];
  let i = 0;
  while (i < src.length) {
    const len = 1 + rng.int(32);
    out.push(src.slice(i, i + len));
    i += len;
  }
  return out;
}

/**
 * Split at every Unicode code-point boundary (never inside a UTF-16
 * surrogate pair). Real LLM tokenizers respect this boundary; the char
 * strategy does not and can split a surrogate in two, which this
 * strategy exercises the happy path for.
 */
function chunkByUnicode(src: string): ReadonlyArray<string> {
  const out: Array<string> = [];
  const iter = src[Symbol.iterator]();
  for (let step = iter.next(); !step.done; step = iter.next()) out.push(step.value);
  return out;
}

/**
 * Split at every boundary known to stress the parser: right after a
 * backtick (code-span opener), right before `]` (link closer), between
 * `<` and the next char (inline-html / autolink), and inside a
 * setext-underline run. No single chunk contains a balanced delimiter
 * pair, so the streaming fast path must re-parse on every chunk.
 */
function chunkByPathological(src: string): ReadonlyArray<string> {
  const boundaries = findPathologicalBoundaries(src);
  return sliceAtBoundaries(src, boundaries);
}

/**
 * Collect every offset that satisfies a "bad boundary" condition.
 *
 * @param src - Source string to scan for pathological split points.
 * @returns Sorted, deduplicated array of offsets strictly between 0 and src.length.
 */
function findPathologicalBoundaries(src: string): ReadonlyArray<number> {
  const set = new Set<number>();
  for (let i = 0; i < src.length; i++) {
    collectBoundaryAt(src, i, set);
  }
  const sorted = Array.from(set).filter((o) => o > 0 && o < src.length);
  sorted.sort((a, b) => a - b);
  return sorted;
}

/**
 * Record boundaries triggered by the character at offset `i`.
 *
 * @param src - Source string being scanned.
 * @param i - Current character offset.
 * @param set - Mutable set to add boundary offsets into.
 */
function collectBoundaryAt(src: string, i: number, set: Set<number>): void {
  const ch = src.charCodeAt(i);
  if (ch === 96) set.add(i + 1); // after `
  if (ch === 93) set.add(i); // before ]
  if (ch === 60) set.add(i + 1); // after <
  if (ch === 61 || ch === 45) recordSetextSplit(src, i, set);
}

/**
 * If `i` sits inside a setext-underline run, emit a mid-run split point.
 *
 * @param src - Source string being scanned.
 * @param i - Current character offset (must be `=` or `-`).
 * @param set - Mutable set to add the split offset into.
 */
function recordSetextSplit(src: string, i: number, set: Set<number>): void {
  const ch = src.charCodeAt(i);
  const prev = i > 0 ? src.charCodeAt(i - 1) : 0;
  const next = i + 1 < src.length ? src.charCodeAt(i + 1) : 0;
  if (prev === ch && next === ch) set.add(i);
}

/**
 * Slice `src` at the sorted boundary offsets.
 *
 * @param src - Source string to split.
 * @param boundaries - Sorted array of split offsets.
 * @returns Array of non-empty substrings whose concatenation equals `src`.
 */
function sliceAtBoundaries(src: string, boundaries: ReadonlyArray<number>): ReadonlyArray<string> {
  if (boundaries.length === 0) return [src];
  const out: Array<string> = [];
  let prev = 0;
  for (const b of boundaries) {
    if (b > prev) out.push(src.slice(prev, b));
    prev = b;
  }
  if (prev < src.length) out.push(src.slice(prev));
  return out;
}
