/**
 * End-to-end streaming tests for `@streamd/cli`.
 *
 * Feeds the CLI pipeline via `Readable.from(["chunk", "chunk", ...])`
 * and asserts:
 *  - `--stream full` emits the full rendered HTML on the last write,
 *    matching `renderHtml(parse(src).tokens)`.
 *  - `--stream off` drains stdin and emits the full HTML once.
 *  - `--stream delta` writes the common-prefix-based additive slice
 *    on each chunk (validated via unit tests on the exported helpers).
 *  - `resolveStreamMode` picks delta for pipes and off for TTYs.
 *
 * @module streaming.test
 */

import { PassThrough, Readable } from "node:stream";
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { describe, expect, it } from "vitest";
import { commonPrefixLen, computeDelta, resolveStreamMode } from "./pipeline";
import { run } from "./run";
import type { RunStreams } from "./types";

describe("streaming — full mode", () => {
  it("last stdout write equals the one-shot render", async () => {
    const chunks = ["hello ", "**world**", "\n"];
    const source = chunks.join("");
    const expected = renderHtml(parse(source).tokens);
    const output = await driveChunks(chunks, ["--stream", "full"]);
    expect(output.writes.length).toBeGreaterThan(0);
    expect(output.writes[output.writes.length - 1]).toBe(expected);
  });

  it("intermediate writes are well-formed HTML for each partial parse", async () => {
    const chunks = ["# he", "llo\n"];
    const output = await driveChunks(chunks, ["--stream", "full"]);
    // First write should be the render for "# he" — still parsed as a heading
    expect(output.writes[0]).toContain("<h1>");
    // Last write is the render for the full source "# hello\n"
    const expected = renderHtml(parse(chunks.join("")).tokens);
    expect(output.writes[output.writes.length - 1]).toBe(expected);
  });
});

describe("streaming — off mode with chunked stdin", () => {
  it("drains stdin and emits the one-shot HTML", async () => {
    const chunks = ["hello ", "**world**", "\n"];
    const source = chunks.join("");
    const expected = renderHtml(parse(source).tokens);
    const output = await driveChunks(chunks, ["--stream", "off"]);
    expect(output.stdout).toBe(expected);
  });
});

describe("streaming — delta mode", () => {
  it("first chunk delta equals the first render in full", async () => {
    const chunks = ["hello\n"];
    const output = await driveChunks(chunks, ["--stream", "delta"]);
    const expected = renderHtml(parse("hello\n").tokens);
    expect(output.writes[0]).toBe(expected);
  });

  it("subsequent chunks emit the common-prefix-based suffix", async () => {
    const chunks = ["hello", " world\n"];
    const output = await driveChunks(chunks, ["--stream", "delta"]);
    const html1 = renderHtml(parse("hello").tokens);
    const html2 = renderHtml(parse("hello world\n").tokens);
    expect(output.writes[0]).toBe(html1);
    expect(output.writes[1]).toBe(computeDelta(html1, html2));
  });
});

describe("resolveStreamMode", () => {
  it("returns explicit modes unchanged", () => {
    const stdin = Readable.from([""]);
    expect(resolveStreamMode("delta", stdin)).toBe("delta");
    expect(resolveStreamMode("full", stdin)).toBe("full");
    expect(resolveStreamMode("off", stdin)).toBe("off");
  });

  it("auto → delta for a non-TTY readable", () => {
    const stdin = Readable.from([""]);
    expect(resolveStreamMode("auto", stdin)).toBe("delta");
  });

  it("auto → off when stdin.isTTY is true", () => {
    const stdin = Readable.from([""]) as Readable & { isTTY?: boolean };
    stdin.isTTY = true;
    expect(resolveStreamMode("auto", stdin)).toBe("off");
  });
});

describe("commonPrefixLen", () => {
  it("returns 0 for disjoint strings", () => {
    expect(commonPrefixLen("abc", "xyz")).toBe(0);
  });

  it("returns the full length when one string is a prefix of the other", () => {
    expect(commonPrefixLen("abc", "abcdef")).toBe(3);
  });

  it("returns the length of the shared prefix when strings diverge", () => {
    expect(commonPrefixLen("abcxx", "abcyy")).toBe(3);
  });

  it("returns 0 for empty inputs", () => {
    expect(commonPrefixLen("", "abc")).toBe(0);
    expect(commonPrefixLen("abc", "")).toBe(0);
  });
});

describe("computeDelta", () => {
  it("returns full next when prev is empty", () => {
    expect(computeDelta("", "<p>hi</p>\n")).toBe("<p>hi</p>\n");
  });

  it("returns the non-shared suffix when prev is a prefix of next", () => {
    expect(computeDelta("<p>hi", "<p>hi there</p>\n")).toBe(" there</p>\n");
  });

  it("returns the divergent suffix when structure changes", () => {
    expect(computeDelta("<p>a</p>\n", "<h1>a</h1>\n")).toBe("h1>a</h1>\n");
  });

  it("returns empty string when next equals prev", () => {
    expect(computeDelta("<p>a</p>\n", "<p>a</p>\n")).toBe("");
  });
});

/**
 * Drive the CLI with an array of explicit chunks and capture every
 * stdout write as a separate string, plus the concatenated stdout.
 *
 * @param chunks Strings written to stdin, one per event loop tick.
 * @param argv CLI argv slice.
 * @returns Writes array, concatenated stdout, stderr, and exit code.
 */
async function driveChunks(
  chunks: ReadonlyArray<string>,
  argv: ReadonlyArray<string>,
): Promise<{ writes: Array<string>; stdout: string; stderr: string; code: number }> {
  const streams = makeStreams(chunks);
  const writes: Array<string> = [];
  streams.stdout.on("data", (chunk: Buffer) => {
    writes.push(chunk.toString("utf8"));
  });
  const code = await run([...argv], streams);
  return {
    writes,
    stdout: writes.join(""),
    stderr: collect(streams.stderr),
    code,
  };
}

/**
 * Build an in-memory `RunStreams` trio seeded with the given stdin
 * chunks. `Readable.from` yields each item as a separate chunk so the
 * streaming pipeline sees exactly the intended boundaries.
 *
 * @param chunks Strings to feed into stdin.
 * @returns Streams suitable for passing to `run()`.
 */
function makeStreams(chunks: ReadonlyArray<string>): RunStreams & {
  stdout: PassThrough;
  stderr: PassThrough;
} {
  return {
    stdin: Readable.from([...chunks]),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  };
}

/**
 * Drain a PassThrough into a UTF-8 string.
 *
 * @param stream PassThrough to drain.
 * @returns Captured content.
 */
function collect(stream: PassThrough): string {
  const parts: Array<Buffer> = [];
  for (;;) {
    const chunk: unknown = stream.read();
    if (chunk === null) break;
    parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(parts).toString("utf8");
}
