/**
 * I/O pipelines: feed stdin through parser + renderer + plugins and
 * emit HTML to stdout.
 *
 * Two modes:
 *  - Non-streaming: drain stdin to a single string, render once.
 *  - Streaming: parse incrementally as each chunk arrives and emit
 *    either the common-prefix delta or the full rendered HTML.
 *
 * Both modes share the theme-header emission and accept an injected
 * `streams` trio so tests can drive them with `Readable.from` /
 * `PassThrough`.
 *
 * @module pipeline
 */

import type { Readable, Writable } from "node:stream";
import { streamHtml } from "@streamd/html";
import type { ParserState } from "@streamd/parser";
import { buildStreamOptions, buildThemeStyleBlock } from "./compose";
import type { CliOptions, CliStreamMode, RunStreams } from "./types";

/** Concrete streaming mode after `"auto"` has been resolved to delta/off. */
type EffectiveStreamMode = "delta" | "full" | "off";

/**
 * A Readable that may carry the Node.js `isTTY` flag. Declared so
 * `resolveStreamMode` can narrow without an inline type assertion.
 *
 * Node sets `isTTY = true` on `process.stdin` when the fd is a
 * terminal; piped or redirected streams lack the property entirely.
 */
interface TtyAwareReadable extends Readable {
  /** `true` when the stream is connected to a terminal device. */
  readonly isTTY?: boolean;
}

/**
 * Resolve `CliStreamMode` to a concrete mode using stdin's TTY state.
 *
 * `"auto"` picks `"off"` for interactive TTYs (so typing at the terminal
 * renders once at EOF) and `"delta"` for pipes (so LLM-like consumers
 * see incremental output).
 *
 * @param mode The user-facing stream mode from CliOptions.
 * @param stdin The readable being consumed (checked for isTTY).
 * @returns One of `"delta"` / `"full"` / `"off"`.
 */
export function resolveStreamMode(mode: CliStreamMode, stdin: Readable): EffectiveStreamMode {
  if (mode === "delta" || mode === "full" || mode === "off") return mode;

  const isTty = (stdin as TtyAwareReadable).isTTY === true;
  return isTty ? "off" : "delta";
}

/**
 * Drain `stdin` to a single UTF-8 string. Used by the non-streaming
 * pipeline and when `--stream off` is in effect.
 *
 * @param stdin Readable source.
 * @returns The full decoded content as a string.
 */
export async function readAllStdin(stdin: Readable): Promise<string> {
  let out = "";
  for await (const chunk of stdin) {
    out += decodeChunk(chunk);
  }
  return out;
}

/**
 * Render the full accumulated markdown once and write the HTML to
 * stdout. Theme stylesheet (if any) is emitted first.
 *
 * @param options Validated CLI options.
 * @param streams Injected stdin/stdout/stderr trio.
 * @returns A promise that resolves when stdin EOF has been written out.
 */
export async function runNonStreaming(options: CliOptions, streams: RunStreams): Promise<void> {
  writeThemeHeader(options, streams.stdout);

  const source = await readAllStdin(streams.stdin);
  const { html } = streamHtml(source, null, buildStreamOptions(options));
  streams.stdout.write(html);
}

/**
 * Stream stdin, parsing each chunk incrementally and writing HTML to
 * stdout. Theme stylesheet (if any) is emitted before the first chunk.
 *
 * In `"delta"` mode the output is the common-prefix addition between
 * the previous and current rendered HTML — safe for most cases where
 * the consumer appends to a display. In `"full"` mode the renderer
 * emits the complete HTML on every chunk (useful for pipelines that
 * split on chunk boundaries, less useful for stdout).
 *
 * @param options Validated CLI options.
 * @param mode Concrete stream mode (`"delta"` or `"full"`).
 * @param streams Injected stdin/stdout/stderr trio.
 * @returns A promise that resolves when stdin EOF has been written out.
 */
export async function runStreaming(
  options: CliOptions,
  mode: "delta" | "full",
  streams: RunStreams,
): Promise<void> {
  writeThemeHeader(options, streams.stdout);

  const ctx = await consumeStdin(options, mode, streams);
  emitTrailingHtmlIfEmpty(ctx, streams.stdout);
}

/** Internal mutable bookkeeping for the streaming loop. */
interface StreamingContext {
  /** Full markdown source accumulated across all stdin chunks so far. */
  accumulated: string;
  /** Opaque parser state carried between incremental `streamHtml` calls. */
  state: ParserState | null;
  /** Last rendered HTML — used to compute the delta for the next chunk. */
  prevHtml: string;
}

/**
 * Iterate stdin chunks and emit HTML on each. Extracted from
 * `runStreaming` to keep both functions under the complexity budget
 * and to make the state transitions testable.
 *
 * @param options Validated CLI options.
 * @param mode Concrete stream mode.
 * @param streams Injected stdin/stdout/stderr trio.
 * @returns Final streaming context with accumulated source + last
 *   rendered HTML for the caller to inspect.
 */
async function consumeStdin(
  options: CliOptions,
  mode: "delta" | "full",
  streams: RunStreams,
): Promise<StreamingContext> {
  const streamOptions = buildStreamOptions(options);
  const ctx: StreamingContext = { accumulated: "", state: null, prevHtml: "" };

  for await (const chunk of streams.stdin) {
    ctx.accumulated += decodeChunk(chunk);
    const { html, state } = streamHtml(ctx.accumulated, ctx.state, streamOptions);
    ctx.state = state;
    emitChunk(streams.stdout, ctx.prevHtml, html, mode);
    ctx.prevHtml = html;
  }

  return ctx;
}

/**
 * Emit the rendered HTML for one stdin chunk in the requested mode.
 *
 * @param stdout Writable to receive output.
 * @param prev Previous rendered HTML.
 * @param next Newly rendered HTML.
 * @param mode Streaming mode.
 */
function emitChunk(stdout: Writable, prev: string, next: string, mode: "delta" | "full"): void {
  if (mode === "full") {
    stdout.write(next);
    return;
  }

  const delta = computeDelta(prev, next);
  if (delta !== "") stdout.write(delta);
}

/**
 * Handle the degenerate case where stdin produced no chunks (empty
 * input). The loop never ran, so `prevHtml` is still `""` — render
 * once anyway to emit the empty-input equivalent (typically an empty
 * string), matching non-streaming behaviour.
 *
 * @param ctx Streaming context after the loop.
 * @param stdout Writable to receive the fallback render.
 */
function emitTrailingHtmlIfEmpty(ctx: StreamingContext, stdout: Writable): void {
  if (ctx.prevHtml !== "" || ctx.accumulated !== "") return;

  const { html } = streamHtml("", null, {});
  if (html !== "") stdout.write(html);
}

/**
 * Compute the additive delta between two rendered HTML strings: the
 * suffix of `next` after the longest common prefix of `prev` and
 * `next`.
 *
 * When structure changes (a paragraph is promoted to a heading, say)
 * the delta will include a large rewrite — this is intentional and
 * correct for consumers that only append to a buffer.
 *
 * @param prev Previously rendered HTML.
 * @param next Newly rendered HTML.
 * @returns Suffix of `next` that differs from `prev`.
 */
export function computeDelta(prev: string, next: string): string {
  const common = commonPrefixLen(prev, next);
  return next.slice(common);
}

/**
 * Length of the longest common prefix between two strings.
 *
 * @param a First string.
 * @param b Second string.
 * @returns Number of leading characters shared by both.
 */
export function commonPrefixLen(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

/**
 * Decode a stdin chunk into a UTF-8 string regardless of whether the
 * stream yielded a Buffer or a string.
 *
 * @param chunk Value yielded by `stdin[Symbol.asyncIterator]`.
 * @returns Decoded string.
 */
function decodeChunk(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString("utf8");
  return String(chunk);
}

/**
 * Write the theme `<style>` block (if any) to stdout. No-op when
 * `--theme none` is in effect.
 *
 * @param options Validated CLI options.
 * @param stdout Writable to receive the header.
 */
function writeThemeHeader(options: CliOptions, stdout: Writable): void {
  const header = buildThemeStyleBlock(options);
  if (header !== null) stdout.write(header);
}
