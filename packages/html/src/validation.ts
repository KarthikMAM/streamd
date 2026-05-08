/**
 * Input validation at the public API trust boundary.
 *
 * Every `renderHtml` / `streamHtml` call funnels through these guards so
 * bad input fails fast with a clear error instead of corrupting the output
 * or crashing mid-render.
 *
 * @module validation
 */

import type { TokensList } from "@streamd/parser";
import { describeArgumentType, StreamdArgumentError } from "@streamd/tokens";
import { htmlErrorMessage } from "./messages";

/** Package identifier used as the `source` field in all thrown errors. */
const SOURCE = "@streamd/html";

/**
 * Discriminator identifying the category of argument violation.
 * Each kind maps to a distinct error scenario at the public API boundary.
 */
export type StreamdHtmlArgumentErrorKind =
  | "tokens-not-array"
  | "source-not-string"
  | "unknown-token-type"
  | "deprecated-option";

/**
 * Error thrown when a `@streamd/html` public-API argument violates its
 * contract. Extends the shared `StreamdArgumentError` so callers can
 * write a single `catch` that covers every package.
 */
export class StreamdHtmlArgumentError extends StreamdArgumentError {
  public constructor(options: StreamdHtmlArgumentErrorFields) {
    super({
      kind: options.kind,
      source: SOURCE,
      caller: options.caller,
      message: options.message,
    });
    this.name = "StreamdHtmlArgumentError";
  }
}

/** Fields accepted by the `StreamdHtmlArgumentError` constructor. */
export interface StreamdHtmlArgumentErrorFields {
  /** Discriminator identifying the category of argument violation. */
  readonly kind: StreamdHtmlArgumentErrorKind;
  /** Name of the public API function that detected the violation. */
  readonly caller: string;
  /** Human-readable error message describing what went wrong. */
  readonly message: string;
}

/**
 * Assert that `tokens` is an array. Throws `StreamdHtmlArgumentError` with
 * the caller name and the received type in the message.
 *
 * @param tokens Value received at a public API boundary.
 * @param caller Name of the caller for diagnostics (e.g. `"renderHtml"`).
 * @throws {StreamdHtmlArgumentError} When `tokens` is not an array.
 */
export function assertTokenList(tokens: unknown, caller: string): asserts tokens is TokensList {
  if (Array.isArray(tokens)) return;
  throw new StreamdHtmlArgumentError({
    kind: "tokens-not-array",
    caller,
    message: htmlErrorMessage.tokensNotArray(caller, describeArgumentType(tokens)),
  });
}

/**
 * Assert that `source` is a string.
 *
 * @param source Value received for a source-string argument.
 * @param caller Name of the caller for diagnostics.
 * @throws {StreamdHtmlArgumentError} When `source` is not a string.
 */
export function assertString(source: unknown, caller: string): asserts source is string {
  if (typeof source === "string") return;
  throw new StreamdHtmlArgumentError({
    kind: "source-not-string",
    caller,
    message: htmlErrorMessage.sourceNotString(caller, describeArgumentType(source)),
  });
}

/**
 * Throws if a removed option is present in the options object.
 * Used as a migration signal for consumers still passing deprecated fields.
 *
 * @param opts - Raw options object from the caller.
 * @param caller - Name of the public API function for diagnostics.
 * @throws {StreamdHtmlArgumentError} With kind `"deprecated-option"`.
 */
export function rejectDeprecatedOptions(opts: unknown, caller: string): void {
  if (opts === null || opts === undefined || typeof opts !== "object") return;
  if ("allowDangerousMetaHtml" in opts) {
    throw new StreamdHtmlArgumentError({
      kind: "deprecated-option",
      caller,
      message: htmlErrorMessage.deprecatedOption(caller, "allowDangerousMetaHtml"),
    });
  }
}
