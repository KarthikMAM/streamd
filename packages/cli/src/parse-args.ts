/**
 * Parse and validate command-line arguments into a {@link CliOptions}
 * object.
 *
 * The public `parseCliArgs` entry point is a pure function — it has no
 * side effects, reads no environment, and throws
 * {@link StreamdCliArgumentError} on any failure. Callers own stdin,
 * stdout, stderr, and `process.exit`.
 *
 * @module parse-args
 */

import { parseArgs } from "node:util";
import { cliErrorMessage } from "./messages";
import type { CliOptions, CliStreamMode, CliTheme } from "./types";
import { StreamdCliArgumentError } from "./validation";

/**
 * Node.js system error shape — errors thrown by core APIs carry a
 * `.code` string (e.g. `"ERR_PARSE_ARGS_UNKNOWN_OPTION"`). Declared
 * here so `errorCodeOf` can narrow without an inline type assertion.
 *
 * This is a structural subtype of `Error` — we only assert the fields
 * we actually read, keeping the cast surface minimal.
 */
interface NodeSystemError extends Error {
  /** Node error code (e.g. `"ERR_PARSE_ARGS_UNKNOWN_OPTION"`). */
  readonly code?: string;
}

/**
 * parseArgs option descriptors.
 *
 * Each negated flag (`--no-gfm`, `--no-sanitize`, `--no-xhtml`) is
 * declared as a separate boolean option so we can support both the
 * positive and negative forms without relying on the per-option
 * `allowNegative` setting (Node 22's support for it is partial).
 */
const OPTIONS = {
  /** Enable GFM extensions (tables, strikethrough, task lists, autolinks). */
  gfm: { type: "boolean" },
  /** Disable GFM — explicit negative form of `--gfm`. */
  "no-gfm": { type: "boolean" },
  /** Enable math (`$...$` inline, `$$...$$` block). */
  math: { type: "boolean" },
  /** CSS class prefix applied to every rendered block tag. */
  "class-prefix": { type: "string" },
  /** Theme stylesheet to prepend (`light`, `dark`, or `none`). */
  theme: { type: "string" },
  /** Add stable `id` attributes to heading tokens. */
  anchors: { type: "boolean" },
  /** Add `rel`/`target` attributes to external link tokens. */
  "link-attrs": { type: "boolean" },
  /** Apply the default-strict sanitize plugin. */
  sanitize: { type: "boolean" },
  /** Disable sanitize — explicit negative form of `--sanitize`. */
  "no-sanitize": { type: "boolean" },
  /** Streaming mode: `auto`, `delta`, `full`, or `off`. */
  stream: { type: "string" },
  /** Wrap output in a root `<div>` with the class prefix. */
  "wrap-root": { type: "boolean" },
  /** Emit XHTML-style self-closing void tags (`<br />`). */
  xhtml: { type: "boolean" },
  /** Disable XHTML — explicit negative form of `--xhtml`. */
  "no-xhtml": { type: "boolean" },
  /** Print version and exit. Short alias: `-v`. */
  version: { type: "boolean", short: "v" },
  /** Print help text and exit. Short alias: `-h`. */
  help: { type: "boolean", short: "h" },
} as const;

/**
 * Shape of the `values` object returned by `parseArgs` with the
 * configured {@link OPTIONS}. Typed here rather than inferred so
 * downstream resolvers can be written against a stable contract.
 *
 * Every field is optional because `parseArgs` only populates keys for
 * flags that were actually present on the command line.
 */
interface ParsedValues {
  /** Whether `--gfm` was passed. */
  readonly gfm?: boolean;
  /** Whether `--no-gfm` was passed. */
  readonly "no-gfm"?: boolean;
  /** Whether `--math` was passed. */
  readonly math?: boolean;
  /** Value of `--class-prefix <str>`. */
  readonly "class-prefix"?: string;
  /** Value of `--theme <light|dark|none>`. */
  readonly theme?: string;
  /** Whether `--anchors` was passed. */
  readonly anchors?: boolean;
  /** Whether `--link-attrs` was passed. */
  readonly "link-attrs"?: boolean;
  /** Whether `--sanitize` was passed. */
  readonly sanitize?: boolean;
  /** Whether `--no-sanitize` was passed. */
  readonly "no-sanitize"?: boolean;
  /** Value of `--stream <auto|delta|full|off>`. */
  readonly stream?: string;
  /** Whether `--wrap-root` was passed. */
  readonly "wrap-root"?: boolean;
  /** Whether `--xhtml` was passed. */
  readonly xhtml?: boolean;
  /** Whether `--no-xhtml` was passed. */
  readonly "no-xhtml"?: boolean;
  /** Whether `--version` / `-v` was passed. */
  readonly version?: boolean;
  /** Whether `--help` / `-h` was passed. */
  readonly help?: boolean;
}

/**
 * Caller name threaded into every `StreamdCliArgumentError` thrown from
 * this module. Matches the public function name so error messages read
 * as `"parseCliArgs: ..."`.
 */
const CALLER = "parseCliArgs";

/**
 * Parse `argv` into validated {@link CliOptions}.
 *
 * Pure function: no I/O, no exit. On any validation failure throws
 * {@link StreamdCliArgumentError} with a descriptive `kind`.
 *
 * @param argv Command-line arguments without the node/script prefix
 *   (i.e. what `process.argv.slice(2)` yields).
 * @returns A fully-defaulted CliOptions record.
 * @throws {StreamdCliArgumentError} When argv contains an unknown flag,
 *   an invalid value, a conflicting pair, or a disallowed positional.
 */
export function parseCliArgs(argv: ReadonlyArray<string>): CliOptions {
  const values = invokeNodeParseArgs(argv);

  const classPrefix = resolveClassPrefix(values);
  const wrapRoot = values["wrap-root"] === true;
  assertWrapRootHasPrefix(wrapRoot, classPrefix);

  return {
    gfm: resolveGfm(values),
    math: values.math === true,
    classPrefix,
    theme: resolveTheme(values),
    anchors: values.anchors === true,
    linkAttrs: values["link-attrs"] === true,
    sanitize: resolveSanitize(values),
    stream: resolveStream(values),
    wrapRoot,
    xhtml: resolveXhtml(values),
    help: values.help === true,
    version: values.version === true,
  };
}

/**
 * Invoke Node's `parseArgs` under strict settings and convert any
 * thrown error into a {@link StreamdCliArgumentError} with a stable
 * `kind`.
 *
 * @param argv Array of raw argv strings.
 * @returns The `values` map produced by parseArgs.
 * @throws {StreamdCliArgumentError} When argv is malformed.
 */
function invokeNodeParseArgs(argv: ReadonlyArray<string>): ParsedValues {
  try {
    const { values } = parseArgs({
      args: [...argv],
      options: OPTIONS,
      strict: true,
      allowPositionals: false,
    });

    return values as ParsedValues;
  } catch (err) {
    throw toCliError(err);
  }
}

/**
 * Map a `parseArgs` error code onto a {@link StreamdCliArgumentError}
 * with a stable `kind`. Rethrows the original error for codes outside
 * the known set so unexpected failures surface faithfully.
 *
 * @param err The error thrown by `parseArgs`.
 * @returns A StreamdCliArgumentError when the code is recognized.
 * @throws The original error when the code is not a parseArgs failure.
 */
function toCliError(err: unknown): StreamdCliArgumentError {
  const code = errorCodeOf(err);
  if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") return unknownFlagError(err);
  if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") return missingValueError(err);
  if (code === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL") return positionalError(err);
  throw err instanceof Error ? err : new Error(String(err));
}

/**
 * Read the `.code` property off a Node error-like value.
 *
 * @param err Any thrown value.
 * @returns The code string, or `undefined` if absent.
 */
function errorCodeOf(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;

  const typed = err as NodeSystemError;
  return typeof typed.code === "string" ? typed.code : undefined;
}

/**
 * Extract a single-quoted token from a parseArgs error message
 * (e.g. `Unknown option '--foo'`). Returns the first quoted substring,
 * or a fallback when the message lacks quotes.
 *
 * @param err Error whose message is scanned.
 * @param fallback String returned when no quoted token is present.
 * @returns The extracted token or the fallback.
 */
function extractQuotedToken(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : String(err);
  const first = message.indexOf("'");
  if (first < 0) return fallback;
  const last = message.indexOf("'", first + 1);
  if (last < 0) return fallback;
  return message.slice(first + 1, last);
}

/**
 * Build a `StreamdCliArgumentError` for an `ERR_PARSE_ARGS_UNKNOWN_OPTION`.
 *
 * @param err Original parseArgs error.
 * @returns A structured CLI error with `kind: "unknown-flag"`.
 */
function unknownFlagError(err: unknown): StreamdCliArgumentError {
  const flag = extractQuotedToken(err, "<unknown>");
  return new StreamdCliArgumentError({
    kind: "unknown-flag",
    caller: CALLER,
    message: cliErrorMessage.unknownFlag(flag),
  });
}

/**
 * Build a `StreamdCliArgumentError` for an `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`.
 *
 * @param err Original parseArgs error.
 * @returns A structured CLI error with `kind: "missing-value"`.
 */
function missingValueError(err: unknown): StreamdCliArgumentError {
  const flag = extractQuotedToken(err, "<unknown>");
  return new StreamdCliArgumentError({
    kind: "missing-value",
    caller: CALLER,
    message: cliErrorMessage.missingValue(flag),
  });
}

/**
 * Build a `StreamdCliArgumentError` for an
 * `ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL`.
 *
 * @param err Original parseArgs error.
 * @returns A structured CLI error with `kind: "positional-not-allowed"`.
 */
function positionalError(err: unknown): StreamdCliArgumentError {
  const arg = extractQuotedToken(err, "<positional>");
  return new StreamdCliArgumentError({
    kind: "positional-not-allowed",
    caller: CALLER,
    message: cliErrorMessage.positionalNotAllowed(arg),
  });
}

/**
 * Throw if both `--<name>` and `--no-<name>` were set simultaneously.
 *
 * @param values parseArgs output.
 * @param positive Positive boolean key (e.g. `"gfm"`).
 * @param negative Negative boolean key (e.g. `"no-gfm"`).
 * @param labelA Human label for the positive flag (e.g. `"--gfm"`).
 * @param labelB Human label for the negative flag (e.g. `"--no-gfm"`).
 * @throws {StreamdCliArgumentError} with `kind: "conflicting-flag"`.
 */
function assertNotBothBooleans(
  values: ParsedValues,
  positive: keyof ParsedValues,
  negative: keyof ParsedValues,
  labelA: string,
  labelB: string,
): void {
  if (values[positive] !== true || values[negative] !== true) return;

  throw new StreamdCliArgumentError({
    kind: "conflicting-flag",
    caller: CALLER,
    message: cliErrorMessage.conflictingFlag(labelA, labelB),
  });
}

/**
 * Resolve the `gfm` boolean from `--gfm` / `--no-gfm` flags. Default: false.
 *
 * @param values parseArgs output.
 * @returns Whether GFM extensions should be enabled.
 */
function resolveGfm(values: ParsedValues): boolean {
  assertNotBothBooleans(values, "gfm", "no-gfm", "--gfm", "--no-gfm");
  if (values["no-gfm"] === true) return false;
  return values.gfm === true;
}

/**
 * Resolve the `sanitize` boolean from `--sanitize` / `--no-sanitize`.
 * Default: true (sanitize is on unless the user opts out).
 *
 * @param values parseArgs output.
 * @returns Whether the sanitize plugin should be applied.
 */
function resolveSanitize(values: ParsedValues): boolean {
  assertNotBothBooleans(values, "sanitize", "no-sanitize", "--sanitize", "--no-sanitize");
  return values["no-sanitize"] !== true;
}

/**
 * Resolve the `xhtml` boolean from `--xhtml` / `--no-xhtml`.
 * Default: true (void tags self-close with ` />`).
 *
 * @param values parseArgs output.
 * @returns Whether the renderer should emit XHTML-style void tags.
 */
function resolveXhtml(values: ParsedValues): boolean {
  assertNotBothBooleans(values, "xhtml", "no-xhtml", "--xhtml", "--no-xhtml");
  return values["no-xhtml"] !== true;
}

/**
 * Resolve the `--theme` value. Default: `"none"`.
 *
 * @param values parseArgs output.
 * @returns A validated {@link CliTheme} value.
 * @throws {StreamdCliArgumentError} with `kind: "unknown-theme"` on
 *   an invalid string.
 */
function resolveTheme(values: ParsedValues): CliTheme {
  const raw = values.theme ?? "none";
  if (raw === "light" || raw === "dark" || raw === "none") return raw;
  throw new StreamdCliArgumentError({
    kind: "unknown-theme",
    caller: CALLER,
    message: cliErrorMessage.unknownTheme(raw),
  });
}

/**
 * Resolve the `--stream` value. Default: `"auto"`.
 *
 * @param values parseArgs output.
 * @returns A validated {@link CliStreamMode} value.
 * @throws {StreamdCliArgumentError} with `kind: "unknown-stream-mode"`
 *   on an invalid string.
 */
function resolveStream(values: ParsedValues): CliStreamMode {
  const raw = values.stream ?? "auto";
  if (raw === "auto" || raw === "delta" || raw === "full" || raw === "off") return raw;
  throw new StreamdCliArgumentError({
    kind: "unknown-stream-mode",
    caller: CALLER,
    message: cliErrorMessage.unknownStream(raw),
  });
}

/**
 * Resolve the `--class-prefix` string. Default: empty string (means
 * "no classes"). Reject an explicit empty value so the user gets a
 * clear error instead of silent no-classes.
 *
 * @param values parseArgs output.
 * @returns The resolved class prefix.
 * @throws {StreamdCliArgumentError} with `kind: "empty-class-prefix"`
 *   when the user passed `--class-prefix ""`.
 */
function resolveClassPrefix(values: ParsedValues): string {
  const raw = values["class-prefix"];
  if (raw === undefined) return "";
  if (raw === "") {
    throw new StreamdCliArgumentError({
      kind: "empty-class-prefix",
      caller: CALLER,
      message: cliErrorMessage.emptyClassPrefix(),
    });
  }
  return raw;
}

/**
 * Throw if `--wrap-root` was set without a class prefix — the renderer
 * needs the prefix to pick a class name for the wrapping div.
 *
 * @param wrapRoot Whether `--wrap-root` was passed.
 * @param classPrefix Resolved class prefix (empty string means none).
 * @throws {StreamdCliArgumentError} with `kind: "wrap-root-requires-prefix"`.
 */
function assertWrapRootHasPrefix(wrapRoot: boolean, classPrefix: string): void {
  if (!wrapRoot || classPrefix !== "") return;
  throw new StreamdCliArgumentError({
    kind: "wrap-root-requires-prefix",
    caller: CALLER,
    message: cliErrorMessage.wrapRootRequiresPrefix(),
  });
}
