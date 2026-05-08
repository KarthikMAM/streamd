/**
 * Input validation at the public API trust boundary.
 *
 * @module validation
 */

import type { TokensList } from "@streamd/parser";
import { describeArgumentType, StreamdArgumentError } from "@streamd/tokens";
import { reactNativeErrorMessage } from "./messages";

const SOURCE = "@streamd/react-native";

/**
 * Error thrown when a `@streamd/react-native` public-API argument
 * violates its contract. Extends the shared `StreamdArgumentError`.
 */
export class StreamdReactNativeArgumentError extends StreamdArgumentError {
  public constructor(options: StreamdReactNativeArgumentErrorFields) {
    super({
      kind: options.kind,
      source: SOURCE,
      caller: options.caller,
      message: options.message,
    });
    this.name = "StreamdReactNativeArgumentError";
  }
}

/**
 * Fields accepted by the `StreamdReactNativeArgumentError` constructor.
 *
 * `kind` is a stable discriminator surfaced on the thrown error so
 * callers can branch on it without pattern-matching message strings.
 */
export interface StreamdReactNativeArgumentErrorFields {
  /** Stable discriminator for programmatic branching without message-string matching. */
  readonly kind:
    | "tokens-not-array"
    | "unknown-token-type"
    | "missing-input"
    | "invalid-chunk"
    | "deprecated-option";
  /** Name of the public API function that detected the violation. */
  readonly caller: string;
  /** Human-readable diagnostic message describing the contract violation. */
  readonly message: string;
}

/**
 * Assert that `tokens` is an array.
 *
 * @param tokens Value received at a public API boundary.
 * @param caller Name of the caller for diagnostics.
 * @throws {StreamdReactNativeArgumentError} When `tokens` is not an array.
 */
export function assertTokenList(tokens: unknown, caller: string): asserts tokens is TokensList {
  if (Array.isArray(tokens)) return;
  throw new StreamdReactNativeArgumentError({
    kind: "tokens-not-array",
    caller,
    message: reactNativeErrorMessage.tokensNotArray(caller, describeArgumentType(tokens)),
  });
}

/**
 * Assert that the caller provided at least one of `source` or `tokens`.
 *
 * @param source Raw markdown source, if any.
 * @param tokens Pre-parsed token list, if any.
 * @param caller Name of the caller for diagnostics.
 * @throws {StreamdReactNativeArgumentError} When both values are `undefined`.
 */
export function assertHasInput(
  source: string | undefined,
  tokens: TokensList | undefined,
  caller: string,
): void {
  if (source !== undefined || tokens !== undefined) return;
  throw new StreamdReactNativeArgumentError({
    kind: "missing-input",
    caller,
    message: reactNativeErrorMessage.missingInput(caller),
  });
}

/**
 * Assert that the streaming chunk is a string.
 *
 * @param chunk Value received by `useStreamingMarkdown.append`.
 * @param caller Name of the caller for diagnostics.
 * @throws {StreamdReactNativeArgumentError} When `chunk` is not a string.
 */
export function assertStringChunk(chunk: unknown, caller: string): asserts chunk is string {
  if (typeof chunk === "string") return;
  throw new StreamdReactNativeArgumentError({
    kind: "invalid-chunk",
    caller,
    message: reactNativeErrorMessage.invalidChunk(caller, describeArgumentType(chunk)),
  });
}

/**
 * Throw if the deprecated `allowDangerousMetaHtml` option is passed.
 *
 * @param options Props or options object that may contain the deprecated field.
 * @param caller Name of the caller for diagnostics.
 * @throws {StreamdReactNativeArgumentError} When the option is present.
 */
export function assertNoDeprecatedOption(
  options: { readonly allowDangerousMetaHtml?: unknown },
  caller: string,
): void {
  if (!("allowDangerousMetaHtml" in options)) return;
  throw new StreamdReactNativeArgumentError({
    kind: "deprecated-option",
    caller,
    message: reactNativeErrorMessage.deprecatedOption(caller, "allowDangerousMetaHtml"),
  });
}
