/**
 * Golden-expected `TokenType` coverage assertion.
 *
 * A silent gap in the generator — e.g. "the mixed roster never emits a
 * `Hardbreak`" — would cause every downstream invariant to pass while
 * failing to exercise the full parser surface. This suite samples the
 * generator across every complexity tier and every seed in `[1, 300]`,
 * then asserts that every reachable `TokenType` value appears at least
 * once in the aggregated token set.
 *
 * ## Space tokens
 *
 * `TokenType.Space` (`"space"`) is defined in the parser's type system
 * but never emitted by the scanner — blank lines are filtered out in
 * `scanner/block/scan.ts`. The assertion below excludes `Space` for
 * that reason.
 *
 * @module fuzzer/coverage.test
 */

import {
  type BlockquoteToken,
  type EmToken,
  type HeadingToken,
  type LinkToken,
  type ListItemToken,
  type ListToken,
  type ParagraphToken,
  parse,
  type StrikethroughToken,
  type StrongToken,
  type TableToken,
  type Token,
  type TokensList,
  TokenType,
  type TokenTypeValue,
} from "@streamd/parser";
import { describe, expect, it } from "vitest";
import { generate } from "./generate";

/** Number of seeds sampled per complexity tier — 300 gives high confidence without excessive runtime. */
const SAMPLE_SIZE = 300;

/** Complexity tiers surveyed — mirrors the main run.test to ensure generator parity. */
const COMPLEXITIES = ["simple", "mixed", "pathological"] as const;

/**
 * `TokenType` values the coverage assertion ignores. `Space` is the
 * only reachable-in-type-system-but-unreachable-in-output kind.
 */
const EXCLUDED_TYPES: ReadonlySet<TokenTypeValue> = new Set([TokenType.Space]);

describe("fuzzer: corpus covers every reachable TokenType", () => {
  it("every TokenType value (except Space) appears across sample corpus", () => {
    const seen = collectReachableTypes();
    const missing = listMissingTypes(seen);
    expect(missing, `missing TokenTypes: ${missing.join(", ")}`).toEqual([]);
  });
});

/** Walk the entire sample corpus and collect every `token.type` seen. */
function collectReachableTypes(): Set<TokenTypeValue> {
  const seen = new Set<TokenTypeValue>();
  for (const complexity of COMPLEXITIES) {
    for (let seed = 1; seed <= SAMPLE_SIZE; seed++) {
      const src = generate(seed, complexity);
      const { tokens } = parse(src, null, { gfm: true, math: true });
      walkAllTokens(tokens, (t) => seen.add(t.type as TokenTypeValue));
    }
  }
  return seen;
}

/** Compute the set of expected `TokenType` values not yet observed. */
function listMissingTypes(seen: ReadonlySet<TokenTypeValue>): Array<TokenTypeValue> {
  const missing: Array<TokenTypeValue> = [];
  for (const v of Object.values(TokenType)) {
    if (EXCLUDED_TYPES.has(v)) continue;
    if (!seen.has(v)) missing.push(v);
  }
  return missing;
}

/**
 * Depth-first token walk. Recurses into every container's `children`
 * array and every table cell's inline sequence.
 */
function walkAllTokens(tokens: TokensList, visit: (t: Token) => void): void {
  for (const token of tokens) {
    visit(token);
    descend(token, visit);
  }
}

/** Dispatch by discriminant tag to the recursive case for containers. */
function descend(token: Token, visit: (t: Token) => void): void {
  switch (token.type) {
    case TokenType.Blockquote:
      walkAllTokens((token as BlockquoteToken).children, visit);
      return;
    case TokenType.List:
      walkList(token as ListToken, visit);
      return;
    case TokenType.ListItem:
      walkAllTokens((token as ListItemToken).children, visit);
      return;
    case TokenType.Heading:
      walkAllTokens((token as HeadingToken).children, visit);
      return;
    case TokenType.Paragraph:
      walkAllTokens((token as ParagraphToken).children, visit);
      return;
    case TokenType.Table:
      walkTable(token as TableToken, visit);
      return;
    case TokenType.Em:
    case TokenType.Strong:
    case TokenType.Strikethrough:
    case TokenType.Link:
      walkAllTokens(
        (token as EmToken | StrongToken | StrikethroughToken | LinkToken).children,
        visit,
      );
      return;
    default:
      return;
  }
}

/** Visit every list item under a list. */
function walkList(token: ListToken, visit: (t: Token) => void): void {
  for (const item of token.children) {
    visit(item);
    walkAllTokens(item.children, visit);
  }
}

/** Visit every inline token in every header and body cell. */
function walkTable(token: TableToken, visit: (t: Token) => void): void {
  for (const cell of token.head) walkAllTokens(cell, visit);
  for (const row of token.rows) {
    for (const cell of row) walkAllTokens(cell, visit);
  }
}
