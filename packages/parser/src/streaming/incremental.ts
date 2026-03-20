/**
 * Incremental streaming parse — the core streaming logic.
 *
 * Handles block promotion, fast-path dispatch, and speculative
 * assembly of the active block region.
 *
 * Fast paths (checked in order):
 * 1. Fenced code continuation — O(K) scan for closing fence only
 * 2. Math block continuation — O(K) scan for closing $$ only
 * 3. Paragraph text append — O(K) extend last Text token
 * 4. Paragraph continuation — skip block scan, re-parse inlines
 *
 * @module streaming/incremental
 */

import type { AssembleOpts } from "../assembler/assemble";
import { assembleBlock, extractAllLinkRefDefs } from "../assembler/assemble";
import { scanBlocks } from "../scanner/block/scan";
import { BlockKind } from "../scanner/block/types";
import { CC_CR, CC_DOLLAR, CC_LF, CC_SPACE, CC_TAB } from "../scanner/constants";
import { parseInlines } from "../scanner/inline/scan";
import type { ParseResult, ParserState } from "../types/options";
import { TokenType } from "../types/token-type";
import type { InlineToken, ParagraphToken, Token } from "../types/tokens";
import {
  createCodeBlockToken,
  createMathBlockToken,
  createParagraphToken,
  createTextToken,
} from "../utils/token-factory";
import {
  extractFencedContent,
  hasFenceClose,
  hasMathClose,
  isParagraphContinuation,
  isPlainTextAppend,
} from "./fast-path";
import { resetActiveState, type StreamState } from "./state";

/**
 * Incremental streaming parse.
 *
 * Caller passes the full accumulated source. Parser compares length
 * against previous call to detect new content, then applies fast paths
 * or falls back to scanning the active block region.
 */
export function streamingParse(src: string, state: StreamState): ParseResult {
  const opts = state.opts;

  // Short-circuit: no new content — re-assemble active region only
  if (src.length <= state.prevLen) {
    return buildResult(state, scanActive(src, state));
  }

  const prevLen = state.prevLen;
  state.prevLen = src.length;

  // ── Pre-line-boundary fast paths (work even without complete lines) ──

  // Fast path 0: paragraph text append — O(K)
  if (
    state.activeBlockKind === BlockKind.Paragraph &&
    state.activeInlines &&
    state.activeInlines.length > 0 &&
    isPlainTextAppend(src, prevLen, src.length, opts.math, opts.autolinks, opts.strikethrough)
  ) {
    const lastInline = state.activeInlines[state.activeInlines.length - 1]!;
    if (lastInline.type === TokenType.Text) {
      const newText = (lastInline as { content: string }).content + src.slice(prevLen);
      // Single-token fast path: avoid array clone — just create [TextToken]
      const inlines =
        state.activeInlines.length === 1
          ? SINGLE_TEXT_INLINES(newText)
          : cloneInlinesWithNewLastText(state.activeInlines, newText);
      state.activeInlines = inlines;
      const para = createParagraphToken(inlines);
      // Avoid concatTokens when no completed tokens
      if (state.completedTokens.length === 0) {
        return {
          tokens: SINGLE_TOKEN(para),
          stableCount: 0,
          state: state as unknown as ParserState,
        };
      }
      return buildResult(state, SINGLE_TOKEN(para));
    }
  }

  // Fast path 1: fenced code continuation — O(K)
  // Check against src.length (not lastComplete) so mid-line chunks inside
  // code blocks don't fall through to the expensive scanActive path.
  if (
    state.activeBlockKind === BlockKind.FencedCode &&
    state.activeContentStart > 0 &&
    !hasFenceClose(src, prevLen, src.length, state.activeFenceChar, state.activeFenceLen)
  ) {
    const content = extractFencedContent(src, state.activeContentStart, src.length);
    return buildResult(state, [createCodeBlockToken(state.activeLang, state.activeInfo, content)]);
  }

  // Fast path 2: math block continuation — O(K)
  if (
    state.activeBlockKind === BlockKind.MathBlock &&
    state.activeContentStart > 0 &&
    !hasMathClose(src, prevLen, src.length)
  ) {
    const content = src.slice(state.activeContentStart, src.length);
    return buildResult(state, [createMathBlockToken(content)]);
  }

  // ── Line-boundary-dependent paths ──

  // Find last complete line boundary
  let lastComplete = src.length;
  if (lastComplete > 0 && src.charCodeAt(lastComplete - 1) !== CC_LF) {
    const lastNL = src.lastIndexOf("\n");
    lastComplete = lastNL >= 0 ? lastNL + 1 : 0;
  }

  // Short-circuit: no complete lines past active block start
  if (lastComplete <= state.activeBlockStart) {
    const activeTokens = scanActive(src, state);
    cacheActiveInlines(state, activeTokens);
    return buildResult(state, activeTokens);
  }

  // Paragraph fast paths (3 & 4) — require complete lines for block-start check
  if (
    state.activeBlockKind === BlockKind.Paragraph &&
    state.activeContentStart > 0 &&
    isParagraphContinuation(src, prevLen, lastComplete, opts.math)
  ) {
    // Fast path 3: pure text append with complete lines — O(K)
    if (
      state.activeInlines &&
      state.activeInlines.length > 0 &&
      isPlainTextAppend(src, prevLen, lastComplete, opts.math, opts.autolinks, opts.strikethrough)
    ) {
      const lastInline = state.activeInlines[state.activeInlines.length - 1]!;
      if (lastInline.type === TokenType.Text) {
        const newText =
          (lastInline as { content: string }).content + src.slice(prevLen, lastComplete);
        const extended = cloneInlinesWithNewLastText(state.activeInlines, newText);
        state.activeInlines = extended;
        return buildResult(state, [createParagraphToken(extended)]);
      }
    }

    // Fast path 4: paragraph continuation — skip block scan, re-parse inlines
    const inlines = parseInlines(
      src,
      state.activeContentStart,
      lastComplete,
      state.refMap,
      opts.math,
      opts.autolinks,
      opts.strikethrough,
    );
    state.activeInlines = inlines;
    return buildResult(state, [createParagraphToken(inlines)]);
  }

  // Full active region scan
  return scanActiveRegion(src, state, opts, lastComplete);
}

/**
 * Clone inline tokens with the last Text token replaced by new content.
 * All tokens before the last are reused by reference (immutable).
 * O(1) for the common case of a single Text token.
 */
function cloneInlinesWithNewLastText(
  inlines: Array<InlineToken>,
  newText: string,
): Array<InlineToken> {
  const len = inlines.length;
  // Fast path: single token — avoid array allocation
  if (len === 1) return [createTextToken(newText)];
  const out = new Array<InlineToken>(len);
  for (let i = 0; i < len - 1; i++) out[i] = inlines[i]!;
  out[len - 1] = createTextToken(newText);
  return out;
}

/** Full active region scan — used when fast paths don't apply. */
function scanActiveRegion(
  src: string,
  state: StreamState,
  opts: AssembleOpts,
  lastComplete: number,
): ParseResult {
  const activeSrc = src.slice(state.activeBlockStart, lastComplete);
  const activeBlocks = scanBlocks(activeSrc, opts.math, opts.tables, opts.taskListItems);

  if (activeBlocks.length === 0) {
    resetActiveState(state);
    return buildResult(state, []);
  }

  // Promote all blocks except the last to completed
  if (activeBlocks.length > 1) {
    const lastIdx = activeBlocks.length - 1;
    const consumed = extractAllLinkRefDefs(activeSrc, activeBlocks, state.refMap);
    for (let i = 0; i < lastIdx; i++) {
      if (consumed.has(i)) continue;
      const t = assembleBlock(activeSrc, activeBlocks[i]!, state.refMap, opts);
      if (t) state.completedTokens.push(t);
    }

    const lastPromoted = activeBlocks[lastIdx - 1]!;
    let newStart = state.activeBlockStart + lastPromoted.end;
    while (newStart < src.length) {
      const ch = src.charCodeAt(newStart);
      if (ch === CC_LF) {
        newStart++;
        break;
      }
      if (ch !== CC_CR && ch !== CC_SPACE && ch !== CC_TAB) break;
      newStart++;
    }
    state.activeBlockStart = newStart;
  }

  // Cache the last active block's metadata for next call's fast paths
  const lastBlock = activeBlocks[activeBlocks.length - 1]!;
  state.activeBlockKind = lastBlock.kind;
  const absContentStart = state.activeBlockStart + lastBlock.contentStart;

  if (lastBlock.kind === BlockKind.Paragraph) {
    state.activeContentStart = absContentStart;
    state.activeFenceChar = 0;
    state.activeFenceLen = 0;
    state.activeLang = "";
    state.activeInfo = "";
    state.activeInlines = null;
  } else if (lastBlock.kind === BlockKind.FencedCode) {
    state.activeContentStart = absContentStart;
    state.activeFenceChar = lastBlock.fenceChar;
    state.activeFenceLen = lastBlock.fenceLength;
    state.activeLang = lastBlock.lang;
    state.activeInfo = lastBlock.info;
    state.activeInlines = null;
  } else if (lastBlock.kind === BlockKind.MathBlock) {
    state.activeContentStart = absContentStart;
    state.activeFenceChar = CC_DOLLAR;
    state.activeFenceLen = 2;
    state.activeLang = "";
    state.activeInfo = "";
    state.activeInlines = null;
  } else {
    resetActiveState(state);
    state.activeBlockKind = lastBlock.kind;
  }

  const activeTokens = assembleActive(src, state, opts);

  // Cache inlines if the active block is a paragraph
  if (
    state.activeBlockKind === BlockKind.Paragraph &&
    activeTokens.length === 1 &&
    activeTokens[0]!.type === TokenType.Paragraph
  ) {
    state.activeInlines = (activeTokens[0] as ParagraphToken).children;
  }

  return buildResult(state, activeTokens);
}

/** Scan and assemble the active region (from activeBlockStart to end of src). */
function scanActive(src: string, state: StreamState): Array<Token> {
  if (state.activeBlockStart >= src.length) return [];
  const activeSrc = src.slice(state.activeBlockStart);
  const blocks = scanBlocks(
    activeSrc,
    state.opts.math,
    state.opts.tables,
    state.opts.taskListItems,
  );
  if (blocks.length === 0) return [];
  const tempRefMap = new Map(state.refMap);
  const consumed = extractAllLinkRefDefs(activeSrc, blocks, tempRefMap);
  const tokens: Array<Token> = [];
  for (let i = 0; i < blocks.length; i++) {
    if (consumed.has(i)) continue;
    const t = assembleBlock(activeSrc, blocks[i]!, tempRefMap, state.opts);
    if (t) tokens.push(t);
  }
  return tokens;
}

/** Assemble the active (last) block speculatively. */
function assembleActive(src: string, state: StreamState, opts: AssembleOpts): Array<Token> {
  if (state.activeBlockStart >= src.length) return [];
  const activeSrc = src.slice(state.activeBlockStart);
  const blocks = scanBlocks(activeSrc, opts.math, opts.tables, opts.taskListItems);
  if (blocks.length === 0) return [];
  const tempRefMap = new Map(state.refMap);
  const consumed = extractAllLinkRefDefs(activeSrc, blocks, tempRefMap);
  const tokens: Array<Token> = [];
  for (let i = 0; i < blocks.length; i++) {
    if (consumed.has(i)) continue;
    const t = assembleBlock(activeSrc, blocks[i]!, tempRefMap, opts);
    if (t) tokens.push(t);
  }
  return tokens;
}

/** Cache inlines from active tokens for the text-append fast path. */
function cacheActiveInlines(state: StreamState, activeTokens: Array<Token>): void {
  if (
    activeTokens.length > 0 &&
    activeTokens[activeTokens.length - 1]!.type === TokenType.Paragraph
  ) {
    state.activeInlines = (activeTokens[activeTokens.length - 1] as ParagraphToken).children;
    state.activeBlockKind = BlockKind.Paragraph;
    if (state.activeContentStart === 0 && activeTokens.length === 1) {
      // First paragraph — content starts at activeBlockStart
      state.activeContentStart = state.activeBlockStart;
    }
  }
}

/** Reusable single-element array for InlineToken — avoids allocation in text-append path. */
function SINGLE_TEXT_INLINES(text: string): Array<InlineToken> {
  return [createTextToken(text)];
}

/** Reusable single-element array for Token — avoids wrapper allocation. */
function SINGLE_TOKEN(token: Token): Array<Token> {
  return [token];
}

/** Build a ParseResult from completed tokens + active tokens. */
function buildResult(state: StreamState, activeTokens: Array<Token>): ParseResult {
  const tokens = concatTokens(state.completedTokens, activeTokens);
  return {
    tokens,
    stableCount: state.completedTokens.length,
    state: state as unknown as ParserState,
  };
}

/** Concatenate two token arrays without mutation. */
function concatTokens(a: Array<Token>, b: Array<Token>): Array<Token> {
  if (b.length === 0) return a;
  if (a.length === 0) return b;
  const out = new Array<Token>(a.length + b.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]!;
  for (let i = 0; i < b.length; i++) out[a.length + i] = b[i]!;
  return out;
}
