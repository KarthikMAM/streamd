/**
 * Fast utility functions for the flat block scanner.
 *
 * `findLineEndFast` uses `String.indexOf` which V8/JSC optimize to
 * SIMD-accelerated search internally — significantly faster than
 * byte-by-byte charCode scanning for long lines.
 *
 * @module scanner/block/utils
 */
import { CC_CR, CC_LF, CC_SPACE, CC_TAB } from "../constants";

/**
 * Find end of current line using indexOf (SIMD-accelerated in V8).
 *
 * Returns position of the line-ending character, or src.length if none.
 * Handles LF, CRLF, and bare CR (when no LF follows on the same line).
 *
 * Known limitation: if a bare CR appears before an LF on the same line
 * (e.g., `"abc\rX\ndef"`), the bare CR is not detected as a line ending.
 * This is a spec §2.1 edge case that doesn't occur in real-world markdown.
 */
export function findLineEndFast(src: string, pos: number): number {
  const idx = src.indexOf("\n", pos);

  if (idx === -1) {
    // No LF found — scan for bare CR
    const len = src.length;
    for (let i = pos; i < len; i++) {
      if (src.charCodeAt(i) === CC_CR) return i;
    }
    return len;
  }

  // CRLF: if char before LF is CR, return the CR position
  if (idx > pos && src.charCodeAt(idx - 1) === CC_CR) return idx - 1;

  return idx;
}

/**
 * Advance past line ending. Handles LF, CRLF, bare CR.
 */
export function nextLine(src: string, lineEnd: number): number {
  if (lineEnd >= src.length) return lineEnd;
  const code = src.charCodeAt(lineEnd);
  if (code === CC_LF) return lineEnd + 1;
  if (code === CC_CR) {
    if (lineEnd + 1 < src.length && src.charCodeAt(lineEnd + 1) === CC_LF) {
      return lineEnd + 2;
    }
    return lineEnd + 1;
  }
  return lineEnd + 1;
}

/** Shared indent result — mutated in place. */
export interface IndentOut {
  indent: number;
  pos: number;
}

/**
 * Count leading indent (spaces + tab expansion) and find first non-space.
 * Mutates `out` to avoid allocation.
 */
export function countIndent(src: string, from: number, lineEnd: number, out: IndentOut): void {
  let indent = 0;
  let p = from;
  while (p < lineEnd) {
    const ch = src.charCodeAt(p);
    if (ch === CC_SPACE) {
      indent++;
      p++;
    } else if (ch === CC_TAB) {
      indent += 4 - (indent % 4);
      p++;
    } else break;
  }
  out.indent = indent;
  out.pos = p;
}

/** Check if a range contains only spaces and tabs. */
export function isBlankRange(src: string, from: number, end: number): boolean {
  for (let i = from; i < end; i++) {
    if (!isSpaceOrTab(src.charCodeAt(i))) return false;
  }
  return true;
}

/** Check if charCode is space or tab. */
export function isSpaceOrTab(ch: number): boolean {
  return ch === CC_SPACE || ch === CC_TAB;
}
