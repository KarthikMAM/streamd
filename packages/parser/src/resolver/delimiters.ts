/**
 * Delimiter resolution algorithm — spec §Appendix.
 *
 * Linear scan forward for closers, backward search for openers
 * with opener-bottom tracking per delimiter type. Handles emphasis
 * (`*`, `_`) and strikethrough (`~`).
 *
 * @module resolver/delimiters
 */

import { CC_STAR, CC_TILDE, CC_UNDERSCORE } from "../scanner/constants";
import type { InlineNode } from "../types/internal";
import type { InlineToken } from "../types/tokens";
import {
  createEmToken,
  createStrikethroughToken,
  createStrongToken,
  createTextToken,
} from "../utils/token-factory";

/**
 * Resolve delimiter runs into emphasis/strong/strikethrough tokens.
 * Spec §Appendix: "process emphasis" algorithm.
 *
 * In streaming mode, unmatched openers are auto-closed.
 */
export function resolveDelimiters(
  nodes: Array<InlineNode>,
  nodeCount: number,
  streaming: boolean,
): Array<InlineToken> {
  // Opener-bottom tracking per delimiter char
  // Prevents re-scanning past previously failed positions
  const openerBottomStar = [0, 0, 0]; // indexed by closerCount % 3
  const openerBottomUnderscore = [0, 0, 0];
  const openerBottomTilde = [0, 0, 0];

  // Process closers left to right
  for (let closerIdx = 0; closerIdx < nodeCount; closerIdx++) {
    const closer = nodes[closerIdx];
    if (!closer || closer.kind !== 1 || !closer.canClose) continue;

    const ch = closer.char;
    if (ch !== CC_STAR && ch !== CC_UNDERSCORE && ch !== CC_TILDE) continue;

    const bottomArr =
      ch === CC_STAR
        ? openerBottomStar
        : ch === CC_UNDERSCORE
          ? openerBottomUnderscore
          : openerBottomTilde;

    // Strikethrough: only match pairs of exactly 2
    if (ch === CC_TILDE) {
      if (closer.count < 2) continue;
      const openerIdx = findOpener(nodes, closerIdx, ch, 2, bottomArr);
      if (openerIdx >= 0) {
        wrapTokens(nodes, openerIdx, closerIdx, 2, ch, nodeCount);
        continue;
      }
      // No match — update bottom
      bottomArr[closer.count % 3] = closerIdx;
      continue;
    }

    // Emphasis: try to match strong (2) then em (1)
    while (closer.kind === 1 && closer.count > 0) {
      const matchCount = closer.count >= 2 ? 2 : 1;
      const openerIdx = findOpener(nodes, closerIdx, ch, matchCount, bottomArr);

      if (openerIdx >= 0) {
        wrapTokens(nodes, openerIdx, closerIdx, matchCount, ch, nodeCount);
      } else {
        // Update opener-bottom
        bottomArr[closer.count % 3] = closerIdx;
        break;
      }
    }
  }

  // Auto-close in streaming mode or clean up
  if (streaming) {
    autoCloseOpeners(nodes, nodeCount);
  }

  return compactNodes(nodes, nodeCount);
}

/**
 * Find matching opener for a closer, searching backward from closerIdx.
 * Respects opener-bottom bound and rule-of-three.
 */
function findOpener(
  nodes: Array<InlineNode>,
  closerIdx: number,
  ch: number,
  matchCount: number,
  bottomArr: Array<number>,
): number {
  const bottom = bottomArr[matchCount % 3] ?? 0;

  for (let i = closerIdx - 1; i >= bottom; i--) {
    const opener = nodes[i];
    if (!opener || opener.kind !== 1 || opener.char !== ch || !opener.canOpen) continue;
    if (opener.count < matchCount) continue;

    // Rule-of-three (spec §6.2 rules 9-10):
    // If either opener or closer can both open and close,
    // and (opener.count + closer.count) % 3 === 0,
    // then they don't match UNLESS both are multiples of 3.
    const closer = nodes[closerIdx];
    if (closer && ((opener.canOpen && opener.canClose) || (closer.canOpen && closer.canClose))) {
      if ((opener.count + closer.count) % 3 === 0) {
        if (opener.count % 3 !== 0 || closer.count % 3 !== 0) {
          continue;
        }
      }
    }

    return i;
  }

  return -1;
}

/**
 * Wrap tokens between opener and closer in Em/Strong/Strikethrough.
 * Adjusts opener/closer counts and marks consumed nodes as dead.
 */
function wrapTokens(
  nodes: Array<InlineNode>,
  openerIdx: number,
  closerIdx: number,
  count: number,
  ch: number,
  _nodeCount: number,
): void {
  const opener = nodes[openerIdx];
  const closer = nodes[closerIdx];
  if (!(opener && closer)) return;

  // Collect inner tokens (between opener and closer)
  const inner: Array<InlineToken> = [];
  for (let i = openerIdx + 1; i < closerIdx; i++) {
    const node = nodes[i];
    if (!node || node.kind === 2) continue;
    if (node.kind === 0 && node.token) {
      inner.push(node.token);
    } else if (node.kind === 1) {
      // Unmatched delimiter becomes text
      inner.push(createTextToken(delimText(node.char, node.count)));
    }
    node.kind = 2; // mark dead
  }

  // Create wrapping token
  let token: InlineToken;
  if (ch === CC_TILDE) {
    token = createStrikethroughToken(inner);
  } else if (count === 2) {
    token = createStrongToken(inner);
  } else {
    token = createEmToken(inner);
  }

  // Consume `count` chars from opener
  opener.count -= count;
  if (opener.count === 0) {
    // Opener fully consumed — place token on opener node
    opener.kind = 0;
    opener.token = token;
    // Closer fully consumed too?
    closer.count -= count;
    if (closer.count === 0) {
      closer.kind = 2; // dead — token is on opener
    }
    // else closer still has remaining delimiters — leave it as kind=1
  } else {
    // Opener still has remaining delimiters — place token on closer
    closer.count -= count;
    if (closer.count === 0) {
      closer.kind = 0;
      closer.token = token;
    } else {
      // Both have remaining — place token on closer, closer stays as delimiter
      // Insert a synthetic token node by repurposing: mark closer as token
      // and keep its remaining count in a new node isn't possible without insertion.
      // Simplest correct approach: place token on closer, closer loses delimiter role.
      closer.kind = 0;
      closer.token = token;
    }
  }
}

/** Build delimiter text without String.fromCharCode in hot path */
function delimText(char: number, count: number): string {
  // Common cases: single char
  if (count === 1) return String.fromCharCode(char);
  if (count === 2) return String.fromCharCode(char) + String.fromCharCode(char);
  return String.fromCharCode(char).repeat(count);
}

/**
 * Auto-close unmatched openers in streaming mode.
 * Unmatched delimiters become emphasis/strong wrapping everything after them.
 */
function autoCloseOpeners(nodes: Array<InlineNode>, nodeCount: number): void {
  for (let i = nodeCount - 1; i >= 0; i--) {
    const node = nodes[i];
    if (!node || node.kind !== 1 || !node.canOpen) continue;

    // Collect tokens after this opener
    const inner: Array<InlineToken> = [];
    for (let j = i + 1; j < nodeCount; j++) {
      const n = nodes[j];
      if (!n || n.kind === 2) continue;
      if (n.kind === 0 && n.token) {
        inner.push(n.token);
      } else if (n.kind === 1) {
        inner.push(createTextToken(delimText(n.char, n.count)));
      }
      n.kind = 2;
    }

    if (inner.length === 0) {
      node.kind = 0;
      node.token = createTextToken(delimText(node.char, node.count));
      continue;
    }

    const ch = node.char;
    let token: InlineToken;
    if (ch === CC_TILDE) {
      token = createStrikethroughToken(inner);
    } else if (node.count >= 2) {
      token = createStrongToken(inner);
    } else {
      token = createEmToken(inner);
    }

    node.kind = 0;
    node.token = token;
    node.count = 0;
  }
}

/**
 * Compact nodes into final InlineToken array.
 * Skip dead nodes, convert remaining delimiters to text.
 */
function compactNodes(nodes: Array<InlineNode>, nodeCount: number): Array<InlineToken> {
  const result: Array<InlineToken> = [];

  for (let i = 0; i < nodeCount; i++) {
    const node = nodes[i];
    if (!node || node.kind === 2) continue;

    if (node.kind === 0 && node.token) {
      result.push(node.token);
    } else if (node.kind === 1) {
      // Unmatched delimiter becomes literal text
      result.push(createTextToken(delimText(node.char, node.count)));
    }
  }

  return result;
}
