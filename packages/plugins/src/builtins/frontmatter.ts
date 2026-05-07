/**
 * `frontmatter` — parses a YAML-style frontmatter block at the top of the
 * source and removes it from the document. The parsed key/value pairs are
 * stored in `ctx.meta.frontmatter`.
 *
 * Because frontmatter operates on source (not tokens), the plugin is
 * exposed as both a token-transform no-op and a source preprocessor:
 *   `preprocessSource(source) → { source, frontmatter }`
 *
 * Renderers that integrate with plugins call `preprocessSource` before
 * `parse`.
 *
 * @module builtins/frontmatter
 */
import { TOKEN_SCHEMA_VERSION } from "@streamd/parser";
import type { Plugin } from "../types";

// --- Fence constants ---

/** Opening fence variant with LF line ending. */
const OPEN_FENCE_LF = "---\n";

/** Opening fence variant with CRLF line ending. */
const OPEN_FENCE_CRLF = "---\r\n";

/** Length of the LF fence variant. */
const OPEN_FENCE_LF_LENGTH = OPEN_FENCE_LF.length;

/** Length of the CRLF fence variant. */
const OPEN_FENCE_CRLF_LENGTH = OPEN_FENCE_CRLF.length;

// --- Character code constants ---

/** ASCII carriage return (`\r`). */
const CC_CR = 13;

/** ASCII double quote (`"`). */
const CC_DOUBLE_QUOTE = 34;

/** ASCII single quote (`'`). */
const CC_SINGLE_QUOTE = 39;

/** Frontmatter preprocessor result. */
export interface FrontmatterResult {
  /** Markdown source with the frontmatter block stripped. */
  readonly source: string;
  /** Parsed key/value pairs from the frontmatter. Empty when no block found. */
  readonly frontmatter: Record<string, string>;
}

/**
 * Strip a YAML-style frontmatter block from the top of the source and
 * return the remaining source plus the parsed key/value pairs.
 *
 * Only bare scalar `key: value` pairs are supported (no nesting, no arrays,
 * single/double quotes on values are stripped). Unknown line shapes are
 * skipped silently.
 *
 * @param source - Full markdown source. May be empty.
 * @returns `{ source, frontmatter }`. When no frontmatter is present the
 *   original source is returned by reference and `frontmatter` is empty.
 */
export function preprocessSource(source: string): FrontmatterResult {
  const openLen = detectOpenFence(source);
  if (openLen === 0) return { source, frontmatter: {} };

  const closeIdx = findCloseFence(source, openLen);
  if (closeIdx === -1) return { source, frontmatter: {} };

  const body = source.slice(openLen, closeIdx);
  const frontmatter = parseScalarYaml(body);
  const closeFenceLen = source.startsWith(OPEN_FENCE_CRLF, closeIdx)
    ? OPEN_FENCE_CRLF_LENGTH
    : OPEN_FENCE_LF_LENGTH;

  return { source: source.slice(closeIdx + closeFenceLen), frontmatter };
}

/**
 * Return the length of the opening fence, or 0 if the source doesn't
 * start with one.
 *
 * @param source - Source string to check.
 * @returns Fence length (4 for LF, 5 for CRLF), or 0 if no fence.
 */
function detectOpenFence(source: string): number {
  if (source.startsWith(OPEN_FENCE_LF)) return OPEN_FENCE_LF_LENGTH;
  if (source.startsWith(OPEN_FENCE_CRLF)) return OPEN_FENCE_CRLF_LENGTH;
  return 0;
}

/**
 * Find the byte offset of the closing `---` fence. Searches line-by-line
 * so CRLF files are handled correctly.
 *
 * @param source - Full source string.
 * @param from - Offset to start searching from (after the opening fence).
 * @returns Offset of the `---` line, or -1 if not found before EOF.
 */
function findCloseFence(source: string, from: number): number {
  let pos = from;

  while (pos < source.length) {
    const nl = source.indexOf("\n", pos);
    if (isClosingFence(source, pos, lineEndOffset(nl, source.length))) return pos;
    if (nl === -1) return -1;
    pos = nl + 1;
  }

  return -1;
}

/**
 * Return the end-of-line offset: the newline position, or source length at EOF.
 *
 * @param newlineIndex - Index of the newline character, or -1 if not found.
 * @param sourceLength - Total source length.
 * @returns Effective line end offset.
 */
function lineEndOffset(newlineIndex: number, sourceLength: number): number {
  return newlineIndex === -1 ? sourceLength : newlineIndex;
}

/**
 * Check whether the slice [pos, lineEnd) is a `---` fence line.
 *
 * @param source - Full source string.
 * @param pos - Start of the line.
 * @param lineEnd - End of the line (exclusive).
 * @returns `true` when the line is exactly `---` (ignoring trailing CR).
 */
function isClosingFence(source: string, pos: number, lineEnd: number): boolean {
  return stripTrailingCr(source.slice(pos, lineEnd)) === "---";
}

/**
 * Strip a single trailing CR character if present.
 *
 * @param line - Line string to strip.
 * @returns Line without trailing CR.
 */
function stripTrailingCr(line: string): string {
  const last = line.length - 1;
  if (last >= 0 && line.charCodeAt(last) === CC_CR) return line.slice(0, last);
  return line;
}

/**
 * Parse a minimal YAML subset (scalar `key: value` per line) into a
 * string-keyed record.
 *
 * @param body - Frontmatter body between the fences.
 * @returns Parsed key-value pairs.
 */
function parseScalarYaml(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = body.split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseScalarLine(line);
    if (parsed !== null) out[parsed.key] = parsed.rawValue;
  }

  return out;
}

/** Parsed scalar line: bare key + raw value string. */
interface ScalarLine {
  /** YAML key (text before the first colon, trimmed). */
  readonly key: string;
  /** Value after the colon, trimmed and unquoted. */
  readonly rawValue: string;
}

/**
 * Parse a single scalar line. Returns null for comment / blank / shapeless lines.
 *
 * @param line - Raw line from the frontmatter body.
 * @returns Parsed key-value pair, or null if the line is not a valid scalar.
 */
function parseScalarLine(line: string): ScalarLine | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) return null;

  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;

  const key = line.slice(0, colonIdx).trim();
  if (key.length === 0) return null;

  return { key, rawValue: stripQuotes(line.slice(colonIdx + 1).trim()) };
}

/**
 * Strip a matching pair of single or double quotes from the start and end.
 *
 * @param raw - Raw value string, possibly quoted.
 * @returns Unquoted value.
 */
function stripQuotes(raw: string): string {
  if (raw.length < 2) return raw;

  const first = raw.charCodeAt(0);
  const last = raw.charCodeAt(raw.length - 1);
  const isDoubleQuoted = first === CC_DOUBLE_QUOTE && last === CC_DOUBLE_QUOTE;
  const isSingleQuoted = first === CC_SINGLE_QUOTE && last === CC_SINGLE_QUOTE;
  const isQuoted = isDoubleQuoted || isSingleQuoted;

  if (isQuoted) return raw.slice(1, -1);
  return raw;
}

/**
 * Create a `frontmatter` plugin instance.
 *
 * The token transform is a no-op (frontmatter is stripped in `preprocessSource`
 * before parsing). The plugin exists so users can include it in a composed
 * plugin list for completeness.
 *
 * @returns Plugin whose transform returns the input tokens unchanged.
 */
export function frontmatter(): Plugin {
  return {
    name: "frontmatter",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens) {
      return tokens;
    },
  };
}
