/**
 * Input validation at the `@streamd/cli` public-API trust boundary.
 *
 * Every `run()` / `parseCliArgs()` call funnels through these guards so
 * bad input fails fast with a structured `StreamdCliArgumentError`
 * instead of causing misleading runtime errors deep in the parser or
 * renderer.
 *
 * @module validation
 */

import { describeArgumentType, StreamdArgumentError } from "@streamd/tokens";
import { cliErrorMessage } from "./messages";

/**
 * Package identifier passed to the base `StreamdArgumentError` so
 * catch-all handlers can distinguish which `@streamd/*` package
 * originated the error without inspecting the class name.
 */
const SOURCE = "@streamd/cli";

/**
 * Stable discriminators for `StreamdCliArgumentError`.
 *
 * Consumers can narrow on the `kind` field — these values are part of
 * the public API and will not be renamed across minor versions.
 */
export type StreamdCliArgumentErrorKind =
  | "unknown-flag"
  | "unknown-theme"
  | "unknown-stream-mode"
  | "missing-value"
  | "positional-not-allowed"
  | "conflicting-flag"
  | "wrap-root-requires-prefix"
  | "empty-class-prefix"
  | "argv-not-array"
  | "argv-item-not-string";

/** Fields accepted by the `StreamdCliArgumentError` constructor. */
export interface StreamdCliArgumentErrorFields {
  /** Discriminator identifying the specific validation failure. */
  readonly kind: StreamdCliArgumentErrorKind;
  /** Name of the public function that detected the error (e.g. `"run"`). */
  readonly caller: string;
  /** Human-readable description suitable for stderr output. */
  readonly message: string;
}

/**
 * Error thrown when a `@streamd/cli` public-API argument, or an argv
 * token, violates its contract.
 *
 * Extends the shared `StreamdArgumentError` so callers can write a
 * single `instanceof StreamdArgumentError` catch that covers every
 * `@streamd/*` package.
 */
export class StreamdCliArgumentError extends StreamdArgumentError {
  /**
   * Build a new CLI argument error.
   *
   * @param options Structured fields — see {@link StreamdCliArgumentErrorFields}.
   */
  public constructor(options: StreamdCliArgumentErrorFields) {
    super({
      kind: options.kind,
      source: SOURCE,
      caller: options.caller,
      message: options.message,
    });
    this.name = "StreamdCliArgumentError";
  }
}

/**
 * Assert that `argv` is an array of strings. Throws
 * `StreamdCliArgumentError` on any deviation so a wrong-typed caller
 * gets a clear error before parseArgs sees garbage.
 *
 * @param argv Value received at the public `run()` boundary.
 * @param caller Name of the caller for diagnostics (e.g. `"run"`).
 * @throws {StreamdCliArgumentError} When `argv` is not an array of strings.
 */
export function assertArgv(argv: unknown, caller: string): asserts argv is ReadonlyArray<string> {
  if (!Array.isArray(argv)) {
    throw new StreamdCliArgumentError({
      kind: "argv-not-array",
      caller,
      message: cliErrorMessage.argvNotArray(describeArgumentType(argv)),
    });
  }
  assertEveryItemIsString(argv, caller);
}

/**
 * Inner loop for {@link assertArgv}. Kept separate so the outer
 * function stays under the project's cognitive-complexity budget.
 *
 * @param argv Array whose items must all be strings.
 * @param caller Name of the caller for diagnostics.
 * @throws {StreamdCliArgumentError} When any item is not a string.
 */
function assertEveryItemIsString(argv: ReadonlyArray<unknown>, caller: string): void {
  for (const [i, item] of argv.entries()) {
    if (typeof item !== "string") {
      throw new StreamdCliArgumentError({
        kind: "argv-item-not-string",
        caller,
        message: cliErrorMessage.argvItemNotString(i, describeArgumentType(item)),
      });
    }
  }
}
