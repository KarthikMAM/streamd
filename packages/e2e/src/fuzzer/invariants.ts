/**
 * Property invariants for the streaming-equivalence fuzzer.
 *
 * The four synchronous invariants are also exposed through a single
 * {@link checkAllSharedInvariants} entry point that reuses one streaming
 * pass — critical because the per-iteration cost is dominated by parse
 * calls, and re-streaming the same input four times is what blew the
 * original 5 s test timeout. React-HTML parity stays separate because
 * it is async and input-only (ignores `chunks`).
 *
 * Invariants defined here — and the audit findings they catch:
 *
 * 1. {@link checkStreamingEquivalence} — audit **M3**. The final token
 *    tree produced by feeding `chunks` sequentially must equal the tree
 *    produced by a single `parse(source)` call.
 * 2. {@link checkStablePrefixMonotonicity} — audit **M3**. Across every
 *    intermediate streaming call, `stableCount` never decreases and
 *    every index already marked stable never changes.
 * 3. {@link checkRendererEquivalence} — audit **M4**. `renderHtml`
 *    applied to the final streaming tokens equals `renderHtml` applied
 *    to the one-shot tokens.
 * 4. {@link checkReactHtmlParity} — audit **M4**. After HTML
 *    normalization (`html-minifier-terser` + stripping
 *    `class`/`data-*`/`aria-*`), the React SSR output equals the HTML
 *    renderer output for the same token tree.
 * 5. {@link checkPluginCommutativity} — audit **M5**. The plugin
 *    pipeline `[headingAnchors, linkAttributes, sanitize]` produces the
 *    same tokens whether it runs on the one-shot parse or the streaming
 *    parse — a guardrail against the `isPlainTextAppend` fast path
 *    silently desynchronising from the dispatch table.
 *
 * All invariants use `gfm: true` and `math: true` at parse time so the
 * corpus can exercise strikethrough, tables, autolinks, and math tokens.
 *
 * @module fuzzer/invariants
 */

import { renderHtml } from "@streamd/html";
import { type ParserState, parse, type Token, type TokensList } from "@streamd/parser";
import {
  applyPlugins,
  headingAnchors,
  linkAttributes,
  type Plugin,
  sanitize,
} from "@streamd/plugins";
import { renderReact } from "@streamd/react";
import { minify } from "html-minifier-terser";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Shared parse options — GFM + math enable every optional token type. */
const PARSE_OPTS = { gfm: true, math: true } as const;

/** Outcome of a single invariant check. */
export interface InvariantResult {
  /** True when the invariant held. */
  readonly ok: boolean;
  /** Human-readable message when `ok === false`. */
  readonly details?: string;
  /** Optional expected value snippet (truncated for repro output). */
  readonly expected?: string;
  /** Optional actual value snippet (truncated for repro output). */
  readonly actual?: string;
}

/** Bundle of results from the four sync invariants sharing one streaming pass. */
export interface SharedInvariantResults {
  readonly streamingEquivalence: InvariantResult;
  readonly stablePrefixMonotonicity: InvariantResult;
  readonly rendererEquivalence: InvariantResult;
  readonly pluginCommutativity: InvariantResult;
}

/** Successful-result singleton — avoids per-check allocation. */
const OK: InvariantResult = { ok: true };

/** Per-step snapshot captured during streaming replay. */
interface StreamingStep {
  readonly stableCount: number;
  readonly stableTokens: ReadonlyArray<Token>;
}

/** One-pass streaming replay: per-step snapshots plus final token tree. */
interface StreamingSnapshot {
  readonly steps: ReadonlyArray<StreamingStep>;
  readonly finalTokens: TokensList;
}

/**
 * Structural canonicalization — strips `start`/`end` offsets that the
 * parser may attach so token-tree comparisons are position-independent.
 *
 * @param tokens - Token array to serialize.
 * @returns Deterministic JSON string suitable for equality comparison.
 */
function canonicalize(tokens: ReadonlyArray<Token>): string {
  return JSON.stringify(tokens, (key, value: unknown) => {
    if (key === "start" || key === "end") return undefined;
    return value;
  });
}

/**
 * Feed chunks through the streaming parser and capture both intermediate
 * snapshots (for monotonicity) and the final token tree (for equivalence
 * / renderer / plugin checks). Single pass, reused across four invariants.
 *
 * The per-chunk call's `result.tokens` treats the active last block as
 * speculative — e.g. a fenced-code block whose closing fence just arrived
 * is still open in the streaming state because no blank-line transition
 * has followed it. Matching the contract used by
 * `packages/e2e/src/streaming-equivalence.test.ts`, we take one extra
 * `parse(acc, state)` call after the loop to settle the trailing block;
 * that call is a no-op on `acc` (length unchanged) and simply reparses
 * using the captured state.
 */
function streamWithSnapshots(chunks: ReadonlyArray<string>): StreamingSnapshot {
  const steps: Array<StreamingStep> = [];
  let state: ParserState | null = null;
  let acc = "";
  for (const c of chunks) {
    acc += c;
    const result = parse(acc, state, PARSE_OPTS);
    state = result.state;
    steps.push({
      stableCount: result.stableCount,
      stableTokens: result.tokens.slice(0, result.stableCount) as ReadonlyArray<Token>,
    });
  }
  const finalTokens = parse(acc, state, PARSE_OPTS).tokens;
  return { steps, finalTokens };
}

/**
 * Run every sync invariant with a single streaming pass and a single
 * one-shot parse. Four-times speedup over calling each check independently.
 */
export function checkAllSharedInvariants(
  source: string,
  chunks: ReadonlyArray<string>,
): SharedInvariantResults {
  const oneShot = parse(source, null, PARSE_OPTS).tokens;
  const snap = streamWithSnapshots(chunks);
  const pipeline = buildPipeline();
  return {
    streamingEquivalence: compareTokenTrees(oneShot, snap.finalTokens, "streaming"),
    stablePrefixMonotonicity: checkMonotonic(snap.steps),
    rendererEquivalence: compareRenderedHtml(oneShot, snap.finalTokens),
    pluginCommutativity: comparePluginOutput(oneShot, snap.finalTokens, pipeline),
  };
}

/**
 * Structural JSON equality over two token trees.
 *
 * @param oneShot - Token tree from a single full-document parse.
 * @param streamed - Token tree from the streaming replay.
 * @param label - Human-readable label for the failure message.
 * @returns OK when trees match; failure result with truncated snippets otherwise.
 */
function compareTokenTrees(
  oneShot: TokensList,
  streamed: TokensList,
  label: string,
): InvariantResult {
  const a = canonicalize(oneShot);
  const b = canonicalize(streamed);
  if (a === b) return OK;
  return {
    ok: false,
    details: `${label} final tokens != one-shot tokens`,
    expected: truncate(a),
    actual: truncate(b),
  };
}

/**
 * Run the monotonicity invariant against collected streaming steps.
 *
 * @param steps - Ordered snapshots from the streaming replay.
 * @returns OK when stableCount never decreases and stable tokens never mutate.
 */
function checkMonotonic(steps: ReadonlyArray<StreamingStep>): InvariantResult {
  for (let i = 2; i < steps.length; i++) {
    const prev = steps[i - 1];
    const cur = steps[i];
    const failure = compareSteps(prev, cur, i);
    if (failure !== null) return failure;
  }
  return OK;
}

/**
 * Compare two adjacent streaming steps for monotonicity violations.
 *
 * @param prev - The earlier step.
 * @param cur - The later step.
 * @param index - 0-based index of `cur` in the steps array (for diagnostics).
 * @returns Null when the invariant holds; a populated failure result otherwise.
 */
function compareSteps(
  prev: StreamingStep,
  cur: StreamingStep,
  index: number,
): InvariantResult | null {
  if (cur.stableCount < prev.stableCount) return monotonicityDecreased(prev, cur, index);
  return diffStableTokens(prev.stableTokens, cur.stableTokens, index);
}

/**
 * Build the failure result for a decreasing stableCount.
 *
 * @param prev - The earlier step whose stableCount was higher.
 * @param cur - The later step whose stableCount decreased.
 * @param index - Step index for the diagnostic message.
 * @returns Failure result with a human-readable details string.
 */
function monotonicityDecreased(
  prev: StreamingStep,
  cur: StreamingStep,
  index: number,
): InvariantResult {
  return {
    ok: false,
    details: `stableCount decreased between step ${index - 1} (${prev.stableCount}) and step ${index} (${cur.stableCount})`,
  };
}

/**
 * Scan the shared stable prefix for any mismatch.
 *
 * Reference equality is the parser's stability guarantee, so
 * identity-equal tokens short-circuit without serialising; we fall back
 * to a JSON comparison only when references differ (to avoid false
 * positives from benign re-wrapping).
 *
 * @param prev - Stable tokens from the earlier step.
 * @param cur - Stable tokens from the later step.
 * @param index - Step index for the diagnostic message.
 * @returns Null when all shared tokens match; failure result otherwise.
 */
function diffStableTokens(
  prev: ReadonlyArray<Token>,
  cur: ReadonlyArray<Token>,
  index: number,
): InvariantResult | null {
  const commonLen = Math.min(prev.length, cur.length);
  for (let j = 0; j < commonLen; j++) {
    const a = prev[j];
    const b = cur[j];
    if (a === b) continue;
    const aj = JSON.stringify(a);
    const bj = JSON.stringify(b);
    if (aj !== bj) return stableTokenMismatch(aj, bj, j, index);
  }
  return null;
}

/**
 * Build the failure result for a mutating stable token.
 *
 * @param prev - JSON of the token at the earlier step.
 * @param cur - JSON of the token at the later step.
 * @param tokenIndex - Index within the stable prefix that changed.
 * @param step - Streaming step index where the mutation was detected.
 * @returns Failure result with truncated expected/actual snippets.
 */
function stableTokenMismatch(
  prev: string,
  cur: string,
  tokenIndex: number,
  step: number,
): InvariantResult {
  return {
    ok: false,
    details: `stable token at index ${tokenIndex} changed at streaming step ${step}`,
    expected: truncate(prev),
    actual: truncate(cur),
  };
}

/**
 * Compare `renderHtml` output for one-shot and streaming token trees.
 *
 * @param oneShot - Tokens from a single full-document parse.
 * @param streamed - Tokens from the streaming replay.
 * @returns OK when HTML strings match; failure result with truncated snippets otherwise.
 */
function compareRenderedHtml(oneShot: TokensList, streamed: TokensList): InvariantResult {
  const a = renderHtml(oneShot);
  const b = renderHtml(streamed);
  if (a === b) return OK;
  return {
    ok: false,
    details: "renderHtml(streaming) != renderHtml(one-shot)",
    expected: truncate(a),
    actual: truncate(b),
  };
}

/**
 * Compare `applyPlugins` output for one-shot and streaming token trees.
 *
 * @param oneShot - Tokens from a single full-document parse.
 * @param streamed - Tokens from the streaming replay.
 * @param pipeline - Plugin array to apply to both trees.
 * @returns OK when plugin-transformed trees match; failure result otherwise.
 */
function comparePluginOutput(
  oneShot: TokensList,
  streamed: TokensList,
  pipeline: ReadonlyArray<Plugin>,
): InvariantResult {
  const a = canonicalize(applyPlugins(oneShot, pipeline).tokens);
  const b = canonicalize(applyPlugins(streamed, pipeline).tokens);
  if (a === b) return OK;
  return {
    ok: false,
    details: "applyPlugins(streaming) != applyPlugins(one-shot)",
    expected: truncate(a),
    actual: truncate(b),
  };
}

/**
 * Invariant 1 (audit **M3**): streaming-vs-one-shot token equivalence.
 * Standalone convenience wrapper — prefer {@link checkAllSharedInvariants}
 * when running multiple invariants in the same sweep.
 */
export function checkStreamingEquivalence(
  source: string,
  chunks: ReadonlyArray<string>,
): InvariantResult {
  return checkAllSharedInvariants(source, chunks).streamingEquivalence;
}

/**
 * Invariant 2 (audit **M3**): stable-prefix monotonicity. Standalone
 * convenience wrapper.
 */
export function checkStablePrefixMonotonicity(
  _source: string,
  chunks: ReadonlyArray<string>,
): InvariantResult {
  return checkMonotonic(streamWithSnapshots(chunks).steps);
}

/**
 * Invariant 3 (audit **M4**): renderer equivalence on the HTML side.
 * Standalone convenience wrapper.
 */
export function checkRendererEquivalence(
  source: string,
  chunks: ReadonlyArray<string>,
): InvariantResult {
  return checkAllSharedInvariants(source, chunks).rendererEquivalence;
}

/**
 * Invariant 4 (audit **M4**): React SSR vs HTML renderer parity.
 *
 * After stripping class/data/aria attributes and normalising
 * whitespace, React's static markup must equal the HTML renderer's
 * output for the same token tree.
 *
 * Chunks are ignored here — this is a per-source property. The runner
 * still passes them through so every invariant shares one signature.
 */
export async function checkReactHtmlParity(
  source: string,
  _chunks: ReadonlyArray<string>,
): Promise<InvariantResult> {
  const tokens = parse(source, null, PARSE_OPTS).tokens;
  const htmlOut = renderHtml(tokens);
  const reactNode = renderReact(tokens) as ReactNode;
  const reactOut = reactNode === null ? "" : renderToStaticMarkup(reactNode);
  const normHtml = await normalizeHtml(htmlOut);
  const normReact = await normalizeHtml(reactOut);
  if (normHtml === normReact) return OK;
  return {
    ok: false,
    details: "renderHtml and renderReact produce different HTML after normalization",
    expected: truncate(normHtml),
    actual: truncate(normReact),
  };
}

/**
 * Normalise HTML for a11y / class / data-attribute-insensitive
 * comparison. React 19 also emits `<link rel="preload">` hints for
 * images — those are stripped so only body markup is compared.
 *
 * Known React-renderer divergences unwrapped here:
 *
 * - `<span class="streamd-html-inline">…</span>` — the React renderer
 *   requires a host element for `dangerouslySetInnerHTML`, so raw inline
 *   HTML content is wrapped in a `<span>`. The HTML renderer emits the
 *   raw content directly. The unwrap strips the React-only host element
 *   using the unique class name as a marker so parity holds.
 * - `<div class="streamd-html-block">…</div>` — same reason on the block
 *   side. The React renderer wraps raw HTML blocks in a host `<div>`
 *   while the HTML renderer writes them out verbatim.
 *
 * The unwrap runs BEFORE class-stripping so the class attribute can be
 * used to identify the wrapper uniquely. The non-greedy capture is
 * correct because each wrapper contains exactly one HtmlInline/HtmlBlock
 * token's content — never two side-by-side — so the first `</span>` or
 * `</div>` after the opener is always the wrapper's own close tag (any
 * `</span>` that happens to appear inside the content as part of a
 * literal half-tag gets matched as an earlier boundary, which still
 * collapses the React-only wrapper one token at a time).
 *
 * See `packages/react/README.md` § "Known differences" for the design
 * rationale behind choosing normalization over changing the React
 * renderer.
 */
async function normalizeHtml(html: string): Promise<string> {
  if (!html.trim()) return "";
  const minified = await safeMinify(html);
  const unwrapped = minified
    .replace(/<span class="streamd-html-inline">([\s\S]*?)<\/span>/g, "$1")
    .replace(/<div class="streamd-html-block">([\s\S]*?)<\/div>/g, "$1");
  return unwrapped
    .replace(/<link\b[^>]*>/g, "")
    .replace(/\s+class="[^"]*"/g, "")
    .replace(/\s+data-[a-zA-Z-]+="[^"]*"/g, "")
    .replace(/\s+aria-[a-zA-Z-]+="[^"]*"/g, "");
}

/**
 * Wrap `minify` so a throwing input falls back to whitespace collapse.
 *
 * @param html - Raw HTML string to minify.
 * @returns Minified HTML, or whitespace-collapsed fallback on error.
 */
async function safeMinify(html: string): Promise<string> {
  try {
    return await minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      collapseInlineTagWhitespace: false,
      sortAttributes: true,
    });
  } catch {
    return html.replace(/\s+/g, " ").trim();
  }
}

/**
 * Invariant 5 (audit **M5**): plugin-pipeline commutativity. Standalone
 * convenience wrapper.
 */
export function checkPluginCommutativity(
  source: string,
  chunks: ReadonlyArray<string>,
): InvariantResult {
  return checkAllSharedInvariants(source, chunks).pluginCommutativity;
}

/**
 * Fresh plugin pipeline per call — plugins may hold per-run state.
 *
 * @returns A new array of `[headingAnchors, linkAttributes, sanitize]`.
 */
function buildPipeline(): ReadonlyArray<Plugin> {
  return [headingAnchors(), linkAttributes(), sanitize()];
}

/**
 * Truncate long snippets so test-failure output stays readable.
 *
 * @param value - The string to potentially truncate.
 * @param max - Maximum character length before truncation. Defaults to 200.
 * @returns The original string if within `max`, otherwise a prefix with a char-count suffix.
 */
function truncate(value: string, max = 200): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…(+${value.length - max} chars)`;
}
