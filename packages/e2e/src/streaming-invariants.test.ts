/**
 * Streaming invariants — critical contracts the streaming-first parser
 * promises to consumers. A regression here would silently corrupt the
 * rendered output in LLM chat UIs during response streaming.
 *
 * Invariants under test:
 *
 * 1. `stableCount` is monotonically non-decreasing as more source is
 *    appended. Stable tokens must stay stable.
 *
 * 2. `tokens[0..stableCount]` are byte-identical (structurally) across
 *    calls. A token that reached the stable prefix cannot retroactively
 *    change.
 *
 * 3. Progressive parsing converges on the same result as a single
 *    full-document parse — the final combined token tree equals the
 *    tree the parser produces when given the whole input at once.
 *
 * 4. Feeding arbitrary chunk boundaries (character-by-character,
 *    word-by-word, line-by-line) never produces a different final
 *    token tree.
 *
 * @module streaming-invariants.test
 */

import { type ParserState, parse, type Token, type TokensList } from "@streamd/parser";
import { describe, expect, it } from "vitest";
import type { FeedStep, StreamingSample } from "./types";

/** Fixture corpus spanning headings, inline formatting, lists, code blocks, and mixed documents. */
const SAMPLES: ReadonlyArray<StreamingSample> = [
  { name: "heading", markdown: "# Heading\n" },
  { name: "paragraph", markdown: "Plain *em* and **strong** text.\n" },
  { name: "list", markdown: "- one\n- two\n- three\n" },
  { name: "code block", markdown: "```ts\nconst x = 1;\n```\n" },
  {
    name: "mixed document",
    markdown:
      "# Title\n\nIntro paragraph with `code` and [a link](https://example.com).\n\n## Section\n\n- a\n- b\n\n> quote\n\n```js\nreturn 42;\n```\n",
  },
];

/**
 * Strip parser-internal positional fields (`start`/`end`) so token-tree
 * comparisons are position-independent.
 *
 * @param tokens - Token array to serialize.
 * @returns Deterministic JSON string suitable for equality comparison.
 */
function canonicalize(tokens: TokensList): string {
  return JSON.stringify(tokens, (_key, value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const filtered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k !== "start" && k !== "end") filtered[k] = v;
      }
      return filtered;
    }
    return value;
  });
}

/**
 * Feed `src` one character at a time through the streaming parser,
 * capturing a snapshot of the stable prefix at each step.
 *
 * @param src - Full markdown source to stream character-by-character.
 * @returns Ordered array of per-character stable-prefix snapshots.
 */
function feedCharacterByCharacter(src: string): ReadonlyArray<FeedStep> {
  const steps: Array<FeedStep> = [];
  let state: ParserState | null = null;
  let accumulated = "";
  for (let i = 0; i < src.length; i++) {
    accumulated += src[i];
    const result = parse(accumulated, state);
    state = result.state;
    steps.push({
      step: i + 1,
      stableCount: result.stableCount,
      stablePrefix: canonicalize(
        result.tokens.slice(0, result.stableCount) as unknown as TokensList,
      ),
    });
  }
  return steps;
}

describe("streaming invariants — stableCount monotonicity", () => {
  for (const { name, markdown } of SAMPLES) {
    it(`never decreases for ${name}`, () => {
      // The first call is fullParse (state=null) which returns every token
      // as stable; subsequent streaming calls reserve the last block as
      // speculative. Monotonicity is defined on the streaming calls only,
      // so skip index 0.
      const steps = feedCharacterByCharacter(markdown);
      let last = 0;
      for (let i = 1; i < steps.length; i++) {
        const s = steps[i];
        expect(s.stableCount).toBeGreaterThanOrEqual(last);
        last = s.stableCount;
      }
    });
  }
});

describe("streaming invariants — stable-prefix immutability", () => {
  for (const { name, markdown } of SAMPLES) {
    it(`tokens[0..stableCount] stays byte-equal for ${name}`, () => {
      const steps = feedCharacterByCharacter(markdown);
      // Compare consecutive pairs starting after the fullParse-seed step (i=1).
      for (let i = 2; i < steps.length; i++) {
        const prev = steps[i - 1];
        const cur = steps[i];
        const commonLen = Math.min(prev.stableCount, cur.stableCount);
        if (commonLen === 0) continue;
        const prevTokens: ReadonlyArray<Token> = JSON.parse(prev.stablePrefix);
        const curTokens: ReadonlyArray<Token> = JSON.parse(cur.stablePrefix);
        for (let j = 0; j < commonLen; j++) {
          expect(JSON.stringify(curTokens[j])).toBe(JSON.stringify(prevTokens[j]));
        }
      }
    });
  }
});

describe("streaming invariants — progressive vs full-document equivalence", () => {
  for (const { name, markdown } of SAMPLES) {
    it(`final streamed tree === single-shot parse for ${name}`, () => {
      const steps = feedCharacterByCharacter(markdown);
      const fullResult = parse(markdown);
      const lastStep = steps[steps.length - 1];
      // The final step's prefix + any post-stable tokens we haven't asserted on
      // should match the single-shot full parse.
      let state: ParserState | null = null;
      let acc = "";
      for (const ch of markdown) {
        acc += ch;
        state = parse(acc, state).state;
      }
      const final = parse(markdown, state);
      expect(canonicalize(final.tokens)).toBe(canonicalize(fullResult.tokens));
      expect(lastStep).toBeDefined();
    });
  }
});

describe("streaming invariants — chunking strategies converge", () => {
  for (const { name, markdown } of SAMPLES) {
    it(`arbitrary chunk boundaries produce the same final tree for ${name}`, () => {
      const single = canonicalize(parse(markdown).tokens);

      // Word-by-word.
      let stateWords: ParserState | null = null;
      let accWords = "";
      for (const word of markdown.split(/(\s+)/)) {
        accWords += word;
        stateWords = parse(accWords, stateWords).state;
      }
      const wordwise = canonicalize(parse(markdown, stateWords).tokens);

      // Line-by-line.
      let stateLines: ParserState | null = null;
      let accLines = "";
      for (const line of markdown.split(/(\n)/)) {
        accLines += line;
        stateLines = parse(accLines, stateLines).state;
      }
      const linewise = canonicalize(parse(markdown, stateLines).tokens);

      expect(wordwise).toBe(single);
      expect(linewise).toBe(single);
    });
  }
});
