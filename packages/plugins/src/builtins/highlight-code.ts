/**
 * `highlightCode` — runs each fenced code block through a user-supplied
 * highlighter. The plugin stores the pre-rendered HTML on the token's
 * `meta.html` field; renderers that support it will emit the HTML verbatim.
 *
 * If `highlight` returns `null` or an empty string, the token is left
 * unchanged and the default code-block rendering is used.
 *
 * @module builtins/highlight-code
 */
import {
  type CodeBlockToken,
  TOKEN_SCHEMA_VERSION,
  type Token,
  type TokensList,
  TokenType,
} from "@streamd/parser";
import type { Plugin } from "../types";

/**
 * Signature for a user highlight function.
 *
 * @param code - Raw code block content including any trailing newline.
 * @param lang - Language string (first word of the info fence). May be empty.
 * @returns Pre-rendered HTML, or null / empty to skip this block.
 */
export type HighlightFn = (code: string, lang: string) => string | null | undefined;

/** Options for `highlightCode`. */
export interface HighlightCodeOptions {
  /** Highlighter. See `HighlightFn`. */
  readonly highlight: HighlightFn;
  /** When true, also highlight code blocks without a language. Default: false. */
  readonly includeUnknown?: boolean;
}

/** Resolved options passed to the per-block annotation function. */
interface ResolvedOptions {
  /** User-supplied highlight function. */
  readonly highlight: HighlightFn;
  /** Whether to highlight code blocks that have no language tag. */
  readonly includeUnknown: boolean;
}

/**
 * Create a `highlightCode` plugin instance.
 *
 * @param options - Highlighter and inclusion flag.
 * @returns Plugin that sets `meta.html` on qualifying code blocks.
 */
export function highlightCode(options: HighlightCodeOptions): Plugin {
  const resolved: ResolvedOptions = {
    highlight: options.highlight,
    includeUnknown: options.includeUnknown === true,
  };

  return {
    name: "highlightCode",
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens: TokensList): TokensList {
      return transformBlocks(tokens, resolved);
    },
  };
}

/**
 * Walk top-level blocks and annotate each qualifying code block with the
 * highlighter's HTML. Returns the input array unchanged when nothing matched.
 *
 * @param tokens - Token list to walk.
 * @param opts - Resolved highlight options.
 * @returns New token list when any block was annotated, input by reference otherwise.
 */
function transformBlocks(tokens: TokensList, opts: ResolvedOptions): TokensList {
  let changed = false;
  const out = new Array<Token>(tokens.length);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const annotated = annotateCodeBlock(token, opts);
    if (annotated !== token) changed = true;
    out[i] = annotated;
  }

  return changed ? out : tokens;
}

/**
 * If `token` is a qualifying code block, return a copy with `meta.html`
 * populated. Otherwise return the token unchanged.
 *
 * @param token - Token to potentially annotate.
 * @param opts - Resolved highlight options.
 * @returns Annotated code block or the original token unchanged.
 */
function annotateCodeBlock(token: Token, opts: ResolvedOptions): Token {
  if (token.type !== TokenType.CodeBlock) return token;

  const code = token as CodeBlockToken;
  const hasNoLang = code.lang.length === 0;
  const isUnknownLangAndIgnored = hasNoLang && !opts.includeUnknown;
  if (isUnknownLangAndIgnored) return code;
  if (code.meta?.html !== undefined) return code;

  const html = opts.highlight(code.content, code.lang);
  if (!html) return code;

  return { ...code, meta: { ...(code.meta ?? {}), html } };
}
