/**
 * Programmatic entry point for the streamd CLI.
 *
 * `run(argv, streams)` is what `src/bin/streamd.ts` invokes after
 * wiring `process.argv.slice(2)` and `{ stdin, stdout, stderr }` in.
 * Because the streams are injected, tests can drive the full CLI from
 * a vitest `it()` block without spawning a child process.
 *
 * @module run
 */

import type { Writable } from "node:stream";
import { CLI_VERSION, HELP_TEXT } from "./help-text";
import { parseCliArgs } from "./parse-args";
import { resolveStreamMode, runNonStreaming, runStreaming } from "./pipeline";
import type { CliOptions, RunStreams } from "./types";
import { assertArgv, StreamdCliArgumentError } from "./validation";

/**
 * Exit code for an argument-parsing failure.
 * Value 2 follows the POSIX/GNU convention where 2 signals incorrect
 * usage (e.g. `grep` returns 2 on bad args).
 */
const EXIT_ARG_ERROR = 2;
/**
 * Exit code for a runtime failure inside the pipeline.
 * Value 1 is the generic "something went wrong" code per POSIX.
 */
const EXIT_RUNTIME_ERROR = 1;
/**
 * Exit code for success.
 * Value 0 is the universal "no error" code.
 */
const EXIT_OK = 0;

/**
 * Run the streamd CLI pipeline end-to-end against the injected
 * streams, returning the intended exit code.
 *
 * Never throws on validated input — every failure funnels into a
 * return value and a `stderr.write` so the caller (bin wrapper or
 * test) can decide what to do with it.
 *
 * @param argv Array of argv strings without the node/script prefix —
 *   i.e. `process.argv.slice(2)` for the bin invocation.
 * @param streams Stdin/stdout/stderr trio. In tests these are
 *   `Readable.from(string)` + `PassThrough` buffers.
 * @returns The intended process exit code (0, 1, or 2).
 * @throws {StreamdCliArgumentError} When `argv` itself is not an
 *   array of strings — this is a programmer error at the public
 *   boundary and is surfaced loudly instead of silently swallowed.
 */
export async function run(argv: unknown, streams: RunStreams): Promise<number> {
  assertArgv(argv, "run");

  const options = tryParseArgs(argv, streams.stderr);
  if (options === null) return EXIT_ARG_ERROR;
  if (options.help) return emitHelp(streams.stdout);
  if (options.version) return emitVersion(streams.stdout);

  return await runPipeline(options, streams);
}

/**
 * Parse argv into {@link CliOptions}, writing any structured CLI
 * argument error to stderr and returning `null` to signal "the caller
 * should exit with code 2".
 *
 * @param argv Validated argv array.
 * @param stderr Writable used for diagnostics.
 * @returns Parsed options, or `null` when argv was invalid.
 */
function tryParseArgs(argv: ReadonlyArray<string>, stderr: Writable): CliOptions | null {
  try {
    return parseCliArgs(argv);
  } catch (err) {
    if (err instanceof StreamdCliArgumentError) {
      stderr.write(`streamd: ${err.message}\n`);
      return null;
    }
    throw err;
  }
}

/**
 * Write the help text and return the success exit code.
 *
 * @param stdout Writable to receive the help text.
 * @returns {@link EXIT_OK}.
 */
function emitHelp(stdout: Writable): number {
  stdout.write(HELP_TEXT);
  return EXIT_OK;
}

/**
 * Write the version and return the success exit code.
 *
 * @param stdout Writable to receive the version line.
 * @returns {@link EXIT_OK}.
 */
function emitVersion(stdout: Writable): number {
  stdout.write(`${CLI_VERSION}\n`);
  return EXIT_OK;
}

/**
 * Dispatch to streaming or non-streaming pipeline based on the
 * resolved stream mode. Runtime errors become exit code 1 with a
 * diagnostic to stderr.
 *
 * @param options Validated CLI options.
 * @param streams Stdin/stdout/stderr trio.
 * @returns Intended exit code.
 */
async function runPipeline(options: CliOptions, streams: RunStreams): Promise<number> {
  const mode = resolveStreamMode(options.stream, streams.stdin);

  try {
    await dispatchPipeline(options, mode, streams);
    return EXIT_OK;
  } catch (err) {
    streams.stderr.write(`streamd: ${describeError(err)}\n`);
    return EXIT_RUNTIME_ERROR;
  }
}

/**
 * Concrete pipeline dispatch once the stream mode is known.
 *
 * @param options Validated CLI options.
 * @param mode Concrete stream mode.
 * @param streams Stdin/stdout/stderr trio.
 */
async function dispatchPipeline(
  options: CliOptions,
  mode: "delta" | "full" | "off",
  streams: RunStreams,
): Promise<void> {
  if (mode === "off") {
    await runNonStreaming(options, streams);
    return;
  }
  await runStreaming(options, mode, streams);
}

/**
 * Format a thrown value for stderr. Prefers the `.message` of an
 * Error-like value; falls back to `String(err)`.
 *
 * @param err Any thrown value.
 * @returns Human-readable description.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
