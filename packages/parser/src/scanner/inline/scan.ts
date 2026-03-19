/**
 * Inline scanner — parses inline content within paragraphs and headings.
 *
 * Spec §Appendix Phase 2. Two-pass approach:
 * 1. Scan content char-by-char via `Uint8Array(128)` dispatch table
 * 2. Resolve delimiters for emphasis/strong/strikethrough
 *
 * Engine optimizations:
 * - §8.5: dispatch table eliminates if/else chain
 * - §8.4: InlineNode pool reused across calls (never shrunk)
 * - §8.3: text spans deferred — pos/end stored, no slice in hot loop
 *
 * @module scanner/inline/scan
 */

import { resolveDelimiters } from "../../resolver/delimiters";
import type { InlineNode, LinkReference } from "../../types/internal";
import type { InlineToken } from "../../types/tokens";
import {
  createHardbreakToken,
  createSoftbreakToken,
  createTextToken,
} from "../../utils/token-factory";
import { CC_SPACE } from "../constants";
import { scanAutolink, scanGfmAutolink } from "./autolink";
import { scanCodeSpan } from "./code";
import {
  H_AUTOLINK,
  H_CODE,
  H_DELIM,
  H_ENTITY,
  H_ESCAPE,
  H_GFM_AUTOLINK,
  H_IMAGE,
  H_LINK,
  H_MATH,
  H_NEWLINE,
  selectDispatch,
} from "./dispatch";
import { scanDelimiterRun } from "./emphasis";
import { scanEntity } from "./entity";
import { scanEscape } from "./escape";
import { scanHtmlInline } from "./html";
import { scanLinkOrImage } from "./link";
import { scanMathInline } from "./math";

/** Module-level reusable node pool — never shrunk, only grown. */
const NODE_POOL: Array<InlineNode> = [];

/** Ensure pool has at least `count` entries, growing if needed */
function ensurePool(count: number): void {
  while (NODE_POOL.length < count) {
    NODE_POOL.push({
      kind: 0,
      token: null,
      char: 0,
      count: 0,
      canOpen: false,
      canClose: false,
      pos: 0,
      end: 0,
    });
  }
}

/**
 * Get a node from the pool at the given index, growing if needed.
 * OPT: avoids pre-allocating worst-case pool size — affects all engines.
 */
function poolNode(idx: number): InlineNode {
  if (idx >= NODE_POOL.length) {
    ensurePool(idx + 32);
  }
  return NODE_POOL[idx]!;
}

/**
 * Push a token node into the pool at the given index.
 * Encapsulates the repeated pattern of setting all InlineNode fields for a token result.
 */
function pushToken(idx: number, token: InlineToken, pos: number, end: number): void {
  const n = poolNode(idx);
  n.kind = 0;
  n.token = token;
  n.char = 0;
  n.count = 0;
  n.canOpen = false;
  n.canClose = false;
  n.pos = pos;
  n.end = end;
}

/**
 * Parse inline content from a string range.
 * Returns array of InlineToken.
 *
 * Two-pass approach:
 * 1. Build InlineNode array (deferred text, delimiter nodes, other tokens)
 * 2. Resolve delimiters into emphasis/strong/strikethrough
 */
export function parseInlines(
  src: string,
  start: number,
  end: number,
  refMap: Map<string, LinkReference>,
  math: boolean = false,
  autolinks: boolean = false,
  strikethrough: boolean = true,
): Array<InlineToken> {
  const dispatch = selectDispatch(math, autolinks, strikethrough);

  // OPT: estimate node count at ~1 per 20 chars instead of worst-case 1:1 — affects all
  const estimatedNodes = Math.max(32, ((end - start) / 20) | 0);
  ensurePool(estimatedNodes);

  let nodeCount = 0;
  let pos = start;
  let textStart = start;

  while (pos < end) {
    const code = src.charCodeAt(pos);

    // OPT: bulk plain-text skip — the #1 optimization for text parsers — affects all
    // Tight inner loop advances over non-special chars without dispatch overhead.
    // For typical prose (~80% plain text), this skips most characters in a single loop.
    const handler = code < 128 ? dispatch[code] : 0;
    if (handler === 0) {
      pos++;
      while (pos < end) {
        const c = src.charCodeAt(pos);
        if (c < 128 && dispatch[c] !== 0) break;
        pos++;
      }
      continue;
    }

    // Flush accumulated text before handling special char
    if (pos > textStart) {
      pushToken(nodeCount, createTextToken(src.slice(textStart, pos)), textStart, pos);
      nodeCount++;
    }

    let handled = false;

    switch (handler) {
      case H_ESCAPE: {
        const result = scanEscape(src, pos, end);
        if (result) {
          pushToken(nodeCount, result.token, pos, result.end);
          nodeCount++;
          pos = result.end;
          textStart = pos;
          handled = true;
        }
        break;
      }
      case H_CODE: {
        const result = scanCodeSpan(src, pos, end);
        if (result) {
          pushToken(nodeCount, result.token, pos, result.end);
          nodeCount++;
          pos = result.end;
          textStart = pos;
          handled = true;
        }
        break;
      }
      case H_DELIM: {
        const run = scanDelimiterRun(src, pos, end);
        if (run && (run.canOpen || run.canClose)) {
          const n = poolNode(nodeCount);
          n.kind = 1;
          n.token = null;
          n.char = code;
          n.count = run.count;
          n.canOpen = run.canOpen;
          n.canClose = run.canClose;
          n.pos = pos;
          n.end = pos + run.count;
          nodeCount++;
          pos += run.count;
          textStart = pos;
          handled = true;
        }
        break;
      }
      case H_LINK: {
        const result = scanLinkOrImage(src, pos, end, false, refMap);
        if (result) {
          pushToken(nodeCount, result.token, pos, result.end);
          nodeCount++;
          pos = result.end;
          textStart = pos;
          handled = true;
        }
        break;
      }
      case H_IMAGE: {
        const result = scanLinkOrImage(src, pos, end, true, refMap);
        if (result) {
          pushToken(nodeCount, result.token, pos, result.end);
          nodeCount++;
          pos = result.end;
          textStart = pos;
          handled = true;
        }
        break;
      }
      case H_AUTOLINK: {
        const autolinkResult = scanAutolink(src, pos, end);
        if (autolinkResult) {
          pushToken(nodeCount, autolinkResult.token, pos, autolinkResult.end);
          nodeCount++;
          pos = autolinkResult.end;
          textStart = pos;
          handled = true;
        } else {
          const htmlResult = scanHtmlInline(src, pos, end);
          if (htmlResult) {
            pushToken(nodeCount, htmlResult.token, pos, htmlResult.end);
            nodeCount++;
            pos = htmlResult.end;
            textStart = pos;
            handled = true;
          }
        }
        break;
      }
      case H_ENTITY: {
        const result = scanEntity(src, pos, end);
        if (result) {
          pushToken(nodeCount, result.token, pos, result.end);
          nodeCount++;
          pos = result.end;
          textStart = pos;
          handled = true;
        }
        break;
      }
      case H_MATH: {
        const result = scanMathInline(src, pos, end);
        if (result) {
          pushToken(nodeCount, result.token, pos, result.end);
          nodeCount++;
          pos = result.end;
          textStart = pos;
          handled = true;
        }
        break;
      }
      case H_NEWLINE: {
        const isHard =
          pos >= start + 2 &&
          src.charCodeAt(pos - 1) === CC_SPACE &&
          src.charCodeAt(pos - 2) === CC_SPACE;
        pushToken(
          nodeCount,
          isHard ? createHardbreakToken() : createSoftbreakToken(),
          pos,
          pos + 1,
        );
        nodeCount++;
        pos++;
        textStart = pos;
        handled = true;
        break;
      }
      case H_GFM_AUTOLINK: {
        const gfmResult = scanGfmAutolink(src, pos, end);
        if (gfmResult) {
          pushToken(nodeCount, gfmResult.token, pos, gfmResult.end);
          nodeCount++;
          pos = gfmResult.end;
          textStart = pos;
          handled = true;
        }
        break;
      }
    }

    if (!handled) {
      textStart = pos;
      pos++;
    }
  }

  // Flush remaining text
  if (pos > textStart) {
    pushToken(nodeCount, createTextToken(src.slice(textStart, pos)), textStart, pos);
    nodeCount++;
  }

  // Resolve delimiters (emphasis, strong, strikethrough)
  return resolveDelimiters(NODE_POOL, nodeCount, false);
}
