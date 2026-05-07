/**
 * Input validation at the public API trust boundary.
 *
 * @module validation
 */

import type { TokensList } from "@streamd/parser";
import { describeArgumentType, StreamdArgumentError } from "@streamd/tokens";
import { reactErrorMessage } from "./messages";

const SOURCE = "@streamd/react";

/**
 * Error thrown when a `@streamd/react` public-API argument violates its
 * contract. Extends the shared `StreamdArgumentError` so consumers can
 * catch all cross-package argument errors with one `instanceof`.
 */
export class StreamdReactArgumentError extends StreamdArgumentError {
  public constructor(options: StreamdReactArgumentErrorFields) {
    super({
      kind: options.kind,
      source: SOURCE,
      caller: options.caller,
      message: options.message,
    });
    this.name = "StreamdReactArgumentError";
  }
}

/**
 * Fields accepted by the `StreamdReactArgumentError` constructor.
 *
 * `kind` is a stable discriminator surfaced on the thrown error so
 * callers can branch on it without pattern-matching message strings.
 */
export interface StreamdReactArgumentErrorFields {
  readonly kind: "tokens-not-array" | "unknown-token-type" | "missing-input" | "invalid-chunk";
  readonly caller: string;
  readonly message: string;
}

/**
 * Assert that `tokens` is an array.
 *
 * @param tokens Value received at a public API boundary.
 * @param caller Name of the caller for diagnostics.
 * @throws {StreamdReactArgumentError} When `tokens` is not an array.
 */
export function assertTokenList(tokens: unknown, caller: string): asserts tokens is TokensList {
  if (Array.isArray(tokens)) return;
  throw new StreamdReactArgumentError({
    kind: "tokens-not-array",
    caller,
    message: reactErrorMessage.tokensNotArray(caller, describeArgumentType(tokens)),
  });
}

/**
 * Assert that the caller provided at least one of `source` or `tokens`.
 *
 * @param source Raw markdown source, if any.
 * @param tokens Pre-parsed token list, if any.
 * @param caller Name of the caller for diagnostics.
 * @throws {StreamdReactArgumentError} When both values are `undefined`.
 */
export function assertHasInput(
  source: string | undefined,
  tokens: TokensList | undefined,
  caller: string,
): void {
  if (source !== undefined || tokens !== undefined) return;
  throw new StreamdReactArgumentError({
    kind: "missing-input",
    caller,
    message: reactErrorMessage.missingInput(caller),
  });
}

/**
 * Assert that the streaming chunk is a string.
 *
 * @param chunk Value received by `useStreamingMarkdown.append`.
 * @param caller Name of the caller for diagnostics.
 * @throws {StreamdReactArgumentError} When `chunk` is not a string.
 */
export function assertStringChunk(chunk: unknown, caller: string): asserts chunk is string {
  if (typeof chunk === "string") return;
  throw new StreamdReactArgumentError({
    kind: "invalid-chunk",
    caller,
    message: reactErrorMessage.invalidChunk(caller, describeArgumentType(chunk)),
  });
}
