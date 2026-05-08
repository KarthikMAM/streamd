/**
 * Integration tests for the programmatic `run()` entry point.
 *
 * Uses `Readable.from(string)` for stdin and `PassThrough` for stdout
 * / stderr so the full CLI runs in-process without spawning a child.
 * Assertions match `renderHtml(parse(md).tokens)` to prove the CLI
 * produces the same HTML as the library APIs it wraps.
 *
 * @module run.test
 */

import { PassThrough, Readable } from "node:stream";
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";
import { describe, expect, it } from "vitest";
import { CLI_VERSION, HELP_TEXT } from "./help-text";
import { run } from "./run";
import type { RunStreams } from "./types";
import { StreamdCliArgumentError } from "./validation";

describe("run — one-shot (--stream off)", () => {
  it("emits the same HTML as renderHtml(parse(src).tokens)", async () => {
    const md = "# hello **world**\n";
    const expected = renderHtml(parse(md).tokens);
    const { stdout, code } = await drive(md, ["--stream", "off"]);
    expect(code).toBe(0);
    expect(stdout).toBe(expected);
  });

  it("produces <h1>hello <strong>world</strong></h1> for the README example", async () => {
    const { stdout, code } = await drive("# hello **world**\n", ["--stream", "off"]);
    expect(code).toBe(0);
    expect(stdout).toBe("<h1>hello <strong>world</strong></h1>\n");
  });

  it("honours --gfm", async () => {
    const { stdout } = await drive("~~gone~~\n", ["--gfm", "--stream", "off"]);
    expect(stdout).toBe("<p><del>gone</del></p>\n");
  });

  it("honours --no-xhtml", async () => {
    const { stdout } = await drive("---\n", ["--no-xhtml", "--stream", "off"]);
    expect(stdout).toBe("<hr>\n");
  });

  it("applies --class-prefix to block tags", async () => {
    const { stdout } = await drive("# a\n", ["--class-prefix", "md", "--stream", "off"]);
    expect(stdout).toContain('<h1 class="md-h1">a</h1>');
  });

  it("wraps with --wrap-root when --class-prefix is set", async () => {
    const { stdout } = await drive("hi\n", [
      "--class-prefix",
      "md",
      "--wrap-root",
      "--stream",
      "off",
    ]);
    expect(stdout.startsWith('<div class="md-root">\n')).toBe(true);
    expect(stdout.trimEnd().endsWith("</div>")).toBe(true);
  });

  it("adds heading anchors when --anchors is passed", async () => {
    const { stdout } = await drive("# hello\n", ["--anchors", "--stream", "off"]);
    expect(stdout).toContain('id="hello"');
  });

  it("adds rel/target to external links with --link-attrs", async () => {
    const { stdout } = await drive("[go](https://x.test)\n", ["--link-attrs", "--stream", "off"]);
    expect(stdout).toContain('rel="noopener noreferrer"');
    expect(stdout).toContain('target="_blank"');
  });

  it("drops raw HTML via default-on sanitize()", async () => {
    const { stdout } = await drive("<script>alert('x')</script>\n", ["--stream", "off"]);
    expect(stdout).not.toContain("<script>");
  });

  it("renders inline HTML as escaped text regardless of --no-sanitize", async () => {
    const { stdout } = await drive("<custom>x</custom>\n", ["--no-sanitize", "--stream", "off"]);
    expect(stdout).toContain("&lt;custom&gt;x&lt;/custom&gt;");
  });

  it("prepends a <style> block when --theme is set", async () => {
    const { stdout } = await drive("# a\n", ["--theme", "light", "--stream", "off"]);
    expect(stdout.startsWith("<style>")).toBe(true);
    expect(stdout).toContain(".streamd-root");
  });
});

describe("run — version and help", () => {
  it("--version prints the version and exits 0", async () => {
    const { stdout, code } = await drive("", ["--version"]);
    expect(code).toBe(0);
    expect(stdout).toBe(`${CLI_VERSION}\n`);
  });

  it("-v short form behaves identically", async () => {
    const { stdout, code } = await drive("", ["-v"]);
    expect(code).toBe(0);
    expect(stdout).toBe(`${CLI_VERSION}\n`);
  });

  it("--help prints HELP_TEXT and exits 0", async () => {
    const { stdout, code } = await drive("", ["--help"]);
    expect(code).toBe(0);
    expect(stdout).toBe(HELP_TEXT);
  });
});

describe("run — argument errors (exit code 2)", () => {
  it("unknown flag writes to stderr and returns 2", async () => {
    const { stderr, code } = await drive("", ["--nope"]);
    expect(code).toBe(2);
    expect(stderr).toContain("--nope");
    expect(stderr).toContain("streamd:");
  });

  it("positional argument writes to stderr and returns 2", async () => {
    const { stderr, code } = await drive("", ["input.md"]);
    expect(code).toBe(2);
    expect(stderr).toContain("positional");
  });

  it("conflicting --gfm / --no-gfm returns 2", async () => {
    const { stderr, code } = await drive("", ["--gfm", "--no-gfm"]);
    expect(code).toBe(2);
    expect(stderr).toContain("--gfm");
    expect(stderr).toContain("--no-gfm");
  });

  it("--wrap-root without --class-prefix returns 2", async () => {
    const { stderr, code } = await drive("", ["--wrap-root"]);
    expect(code).toBe(2);
    expect(stderr).toContain("--wrap-root");
  });
});

describe("run — assertArgv at the public boundary", () => {
  it("throws StreamdCliArgumentError when argv is not an array", async () => {
    const streams = makeStreams("");
    await expect(run("not-an-array" as unknown as Array<string>, streams)).rejects.toBeInstanceOf(
      StreamdCliArgumentError,
    );
  });

  it("throws when an argv entry is not a string", async () => {
    const streams = makeStreams("");
    await expect(run(["--gfm", 42 as unknown as string], streams)).rejects.toBeInstanceOf(
      StreamdCliArgumentError,
    );
  });
});

describe("run — binary / typed-array stdin", () => {
  it("decodes Uint8Array chunks as UTF-8", async () => {
    const md = "# hello\n";
    const stdin = Readable.from([Buffer.from(md, "utf8")]);
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const code = await run(["--stream", "off"], { stdin, stdout, stderr });
    expect(code).toBe(0);
    expect(collect(stdout)).toBe("<h1>hello</h1>\n");
  });

  it("coerces non-string non-Uint8Array stdin chunks via String()", async () => {
    // Node streams normally emit string or Buffer; exotic sources can
    // emit other types (e.g. an iterator of Number or a custom object
    // with a toString()). decodeChunk falls back to String(chunk).
    const obj = { toString: () => "# from-object\n" };
    const stdin = Readable.from([obj as unknown as string]);
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const code = await run(["--stream", "off"], { stdin, stdout, stderr });
    expect(code).toBe(0);
    expect(collect(stdout)).toBe("<h1>from-object</h1>\n");
  });
});

/**
 * Convenience helper: feed `input` through `run(argv, ...)` and return
 * captured stdout / stderr + the exit code.
 *
 * @param input Markdown source fed into stdin.
 * @param argv CLI argv slice.
 * @returns Captured output + exit code.
 */
async function drive(
  input: string,
  argv: ReadonlyArray<string>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  const streams = makeStreams(input);
  const code = await run([...argv], streams);
  return {
    stdout: collect(streams.stdout),
    stderr: collect(streams.stderr),
    code,
  };
}

/**
 * Build an in-memory `RunStreams` trio seeded with the given stdin
 * content. Stdout and stderr are `PassThrough` so `collect()` can
 * drain them after `run()` resolves.
 *
 * @param input String written to stdin.
 * @returns Streams suitable for passing to `run()`.
 */
function makeStreams(input: string): RunStreams & {
  stdout: PassThrough;
  stderr: PassThrough;
} {
  return {
    stdin: Readable.from([input]),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  };
}

/**
 * Drain a PassThrough into a UTF-8 string. Called after `run()`
 * resolves — the underlying streams have already seen `end()`.
 *
 * @param stream PassThrough to drain.
 * @returns Captured content.
 */
function collect(stream: PassThrough): string {
  const chunks: Array<Buffer> = [];
  for (;;) {
    const chunk: unknown = stream.read();
    if (chunk === null) break;
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}
