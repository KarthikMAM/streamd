/**
 * Streaming-vs-full equivalence: feeding the source character-by-character
 * should produce the same final token tree (and thus the same HTML) as a
 * one-shot parse.
 *
 * @module streaming-equivalence.test
 */
import { renderHtml, streamHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { describe, expect, it } from "vitest";

/** Markdown fixtures covering the major block types — each is streamed char-by-char. */
const inputs: ReadonlyArray<string> = [
  "# heading\n\nParagraph with **bold** and *em*.\n",
  "> a blockquote\n> continuing\n",
  "- one\n- two\n- three\n",
  "1. first\n2. second\n",
  "```js\nconst x = 1;\nconsole.log(x);\n```\n",
  "body text with [a link](/u) and an ![image](/img)\n",
  "mixed\n\n- bullet\n- another\n\n```py\ndef f(): pass\n```\n",
];

describe("streaming-vs-full equivalence", () => {
  for (const md of inputs) {
    it(`char-by-char matches one-shot for ${JSON.stringify(md.slice(0, 32))}…`, () => {
      const oneShot = renderHtml(parse(md, null, { gfm: true }).tokens);
      let state = null as unknown as Parameters<typeof streamHtml>[1];
      let acc = "";
      for (const c of md) {
        acc += c;
        state = streamHtml(acc, state, { parse: { gfm: true } }).state;
      }
      const streamed = streamHtml(acc, state, { parse: { gfm: true } }).html;
      expect(streamed).toBe(oneShot);
    });
  }
});

describe("streaming stability", () => {
  it("consecutive calls without new content return identical html", () => {
    const { state, html } = streamHtml("hello\n", null);
    const again = streamHtml("hello\n", state);
    expect(again.html).toBe(html);
  });

  it("stableCount tokens never change across a streaming session", () => {
    // First call uses fullParse (all tokens reported as stable); streaming
    // calls reserve the last block as speculative. Start comparison from the
    // second iteration to test streaming-call invariants only.
    const src = "# a\n\n# b\n\n# c\n";
    let state = null as unknown as Parameters<typeof parse>[1];
    let acc = "";
    const stableSnapshots: Array<Array<unknown>> = [];
    for (const c of src) {
      acc += c;
      const r = parse(acc, state);
      state = r.state;
      stableSnapshots.push(r.tokens.slice(0, r.stableCount));
    }
    for (let i = 2; i < stableSnapshots.length; i++) {
      const prev = stableSnapshots[i - 1];
      const cur = stableSnapshots[i];
      expect(cur.length).toBeGreaterThanOrEqual(prev.length);
      for (let j = 0; j < prev.length; j++) {
        expect(JSON.stringify(cur[j])).toBe(JSON.stringify(prev[j]));
      }
    }
  });
});
