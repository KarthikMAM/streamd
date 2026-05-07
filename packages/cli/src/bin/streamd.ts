#!/usr/bin/env node
/**
 * `streamd` bin — thin wrapper around {@link run} that wires in
 * `process.argv` / stdio and translates the returned exit code into a
 * `process.exit(code)` call.
 *
 * Also installs SIGINT / SIGTERM handlers that flush pending output
 * and exit with the conventional 130 / 143 codes so callers can
 * distinguish a signal-driven termination from a runtime or argument
 * failure.
 *
 * @module bin/streamd
 */

import { run } from "../run";

/**
 * Exit code for SIGINT per POSIX (128 + signal number 2).
 * Lets callers distinguish "user pressed Ctrl-C" from a runtime error.
 */
const EXIT_SIGINT = 130;
/**
 * Exit code for SIGTERM per POSIX (128 + signal number 15).
 * Lets callers distinguish "process was killed" from a runtime error.
 */
const EXIT_SIGTERM = 143;
/**
 * Generic failure fallback when the pipeline throws unexpectedly.
 * Value 1 is the universal "something went wrong" code per POSIX.
 */
const EXIT_UNEXPECTED = 1;

installSignalHandlers();

run(process.argv.slice(2), {
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
}).then(
  (code) => {
    process.exit(code);
  },
  (err: unknown) => {
    process.stderr.write(`streamd: ${describeFatal(err)}\n`);
    process.exit(EXIT_UNEXPECTED);
  },
);

/**
 * Install handlers that terminate with the conventional exit codes on
 * SIGINT / SIGTERM. Output buffers are flushed via `process.exit`
 * which implicitly ends the stdout/stderr streams.
 */
function installSignalHandlers(): void {
  process.on("SIGINT", () => {
    process.exit(EXIT_SIGINT);
  });
  process.on("SIGTERM", () => {
    process.exit(EXIT_SIGTERM);
  });
}

/**
 * Format a top-level thrown value for the unhandled-error path.
 *
 * @param err Any thrown value escaping `run`.
 * @returns Human-readable description.
 */
function describeFatal(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
