/**
 * `headingAnchors` — injects stable `id` attributes on heading tokens so
 * they can be linked as anchors. The id is generated from the heading's
 * rendered text by a slug function (GitHub-style default).
 *
 * Duplicate slugs within a single document are suffixed `-2`, `-3`, etc.
 *
 * @module builtins/heading-anchors
 */
import {
  type HeadingToken,
  type InlineToken,
  TOKEN_SCHEMA_VERSION,
  type Token,
  type TokensList,
  TokenType,
} from "@streamd/parser";
import type { Plugin } from "../types";

// --- Character code constants ---

/** ASCII `0`. */
const CC_0 = 48;

/** ASCII `9`. */
const CC_9 = 57;

/** ASCII `A`. */
const CC_A_UPPER = 65;

/** ASCII `Z`. */
const CC_Z_UPPER = 90;

/** ASCII `a`. */
const CC_A_LOWER = 97;

/** ASCII `z`. */
const CC_Z_LOWER = 122;

/** ASCII `-`. */
const CC_DASH = 45;

/** Offset to convert uppercase ASCII to lowercase. */
const UPPER_TO_LOWER_OFFSET = 32;

/** Boundary above which characters are non-ASCII (kept in slug). */
const ASCII_MAX = 127;

/** Options for `headingAnchors`. */
export interface HeadingAnchorsOptions {
  /** Custom slug generator. Default: github-style (lowercase, alnum + dash). */
  readonly slug?: (text: string) => string;
  /** Max heading level to annotate, inclusive. Default: 6 (all levels). */
  readonly maxLevel?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Build a GitHub-style slug from a string: lowercase ASCII alphanumerics and
 * non-ASCII characters are kept, all other runs collapse to a single `-`,
 * trailing dashes are stripped.
 *
 * @param text - Plain text to slugify. May be empty.
 * @returns Slug suitable for a URL fragment. Empty input yields `""`.
 */
function defaultSlug(text: string): string {
  let out = "";
  let lastDash = false;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    if (isAlphaNum(code)) {
      const isUpper = code >= CC_A_UPPER && code <= CC_Z_UPPER;
      out += isUpper ? String.fromCharCode(code + UPPER_TO_LOWER_OFFSET) : text[i];
      lastDash = false;
    } else if (code > ASCII_MAX) {
      out += text[i];
      lastDash = false;
    } else if (!lastDash && out.length > 0) {
      out += "-";
      lastDash = true;
    }
  }

  return trimTrailingDashes(out);
}

/**
 * Strip one or more trailing `-` characters.
 *
 * @param text - Input string. May be empty.
 * @returns String with trailing dashes removed.
 */
function trimTrailingDashes(text: string): string {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === CC_DASH) end--;
  return text.slice(0, end);
}

/**
 * ASCII alphanumeric test (0-9, A-Z, a-z).
 *
 * @param code - Character code to test.
 * @returns `true` when the code is an ASCII letter or digit.
 */
function isAlphaNum(code: number): boolean {
  if (code >= CC_0 && code <= CC_9) return true;
  if (code >= CC_A_UPPER && code <= CC_Z_UPPER) return true;
  if (code >= CC_A_LOWER && code <= CC_Z_LOWER) return true;
  return false;
}

/**
 * Recursively collect the plain-text content of inline tokens for slug
 * generation. Softbreaks / hardbreaks become single spaces; images use
 * their alt text; code spans and escapes are preserved literally.
 *
 * @param tokens - Inline sequence. Empty input returns `""`.
 * @returns Concatenated text representation.
 */
function inlineText(tokens: ReadonlyArray<InlineToken>): string {
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    out += inlineTokenText(tokens[i]);
  }
  return out;
}

/**
 * Extract the plain-text of a single inline token.
 *
 * @param token - Inline token to extract text from.
 * @returns Plain text content of the token.
 */
function inlineTokenText(token: InlineToken): string {
  switch (token.type) {
    case TokenType.Text:
    case TokenType.CodeSpan:
    case TokenType.Escape:
    case TokenType.MathInline:
      return token.content;
    case TokenType.Softbreak:
    case TokenType.Hardbreak:
      return " ";
    case TokenType.Em:
    case TokenType.Strong:
    case TokenType.Strikethrough:
    case TokenType.Link:
      return inlineText(token.children);
    case TokenType.Image:
      return token.alt;
    default:
      return "";
  }
}

/**
 * Create a `headingAnchors` plugin instance.
 *
 * @param options - Slug function and maximum level filter.
 * @returns Plugin that assigns `meta.id` on matching headings.
 */
export function headingAnchors(options: HeadingAnchorsOptions = {}): Plugin {
  const slug = options.slug ?? defaultSlug;
  const maxLevel = options.maxLevel ?? 6;

  return {
    name: "headingAnchors",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens: TokensList): TokensList {
      const counts = new Map<string, number>();
      return rewrite(tokens, slug, maxLevel, counts);
    },
  };
}

/**
 * Walk top-level tokens; annotate each qualifying heading with a unique id.
 *
 * @param tokens - Token list to walk.
 * @param slug - Slug generation function.
 * @param maxLevel - Maximum heading level to annotate.
 * @param counts - Mutable map tracking slug occurrences for deduplication.
 * @returns New token list when any heading was annotated, input by reference otherwise.
 */
function rewrite(
  tokens: TokensList,
  slug: (s: string) => string,
  maxLevel: number,
  counts: Map<string, number>,
): TokensList {
  const out = new Array<Token>(tokens.length);
  let changed = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const annotated = annotateHeading(token, slug, maxLevel, counts);
    if (annotated !== token) changed = true;
    out[i] = annotated;
  }

  return changed ? out : tokens;
}

/**
 * If `token` is a qualifying heading, return a copy with `meta.id` set.
 * Otherwise return the token unchanged.
 *
 * @param token - Token to potentially annotate.
 * @param slug - Slug generation function.
 * @param maxLevel - Maximum heading level to annotate.
 * @param counts - Mutable map tracking slug occurrences for deduplication.
 * @returns Annotated heading or the original token unchanged.
 */
function annotateHeading(
  token: Token,
  slug: (s: string) => string,
  maxLevel: number,
  counts: Map<string, number>,
): Token {
  if (token.type !== TokenType.Heading) return token;

  const heading = token as HeadingToken;
  if (heading.level > maxLevel) return heading;
  if (heading.meta?.id !== undefined) return heading;

  const id = nextUniqueSlug(slug(inlineText(heading.children)), counts);
  if (id.length === 0) return heading;

  return { ...heading, meta: { ...(heading.meta ?? {}), id } };
}

/**
 * Return a unique slug for the current document, adding `-2` / `-3` suffixes
 * on repeats. Updates the counts map as a side effect.
 *
 * @param base - Base slug before deduplication. Empty yields `""`.
 * @param counts - Mutable map tracking how many times each slug has appeared.
 * @returns Unique slug string.
 */
function nextUniqueSlug(base: string, counts: Map<string, number>): string {
  if (base.length === 0) return "";

  const previous = counts.get(base) ?? 0;
  counts.set(base, previous + 1);

  return previous === 0 ? base : `${base}-${previous + 1}`;
}
