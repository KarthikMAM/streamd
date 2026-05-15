/**
 * Walker and plugin-pipeline utilities.
 *
 * `walk` — depth-first traversal with a visitor that can return a replacement
 * token, `null` to drop the token, or `undefined` to keep it unchanged.
 *
 * `applyPlugins` — runs a plugin list in order, threading the meta bag through.
 * Before running, enforces two ABI guardrails:
 *   1. Every plugin must declare `requires.tokenSchema` matching the parser's
 *      `TOKEN_SCHEMA_VERSION` (throws `"missing-requires"` /
 *      `"token-schema-mismatch"`).
 *   2. If a plugin's `transform` throws, the error is rewrapped as a
 *      `StreamdPluginAbiError` with `kind: "transform-failed"`, the plugin
 *      name, and the original error as `cause` (throws `"transform-failed"`).
 *
 * Both functions are structural: they never mutate the input tokens. Tokens
 * that are not changed by the visitor are reused by reference, so unchanged
 * subtrees share memory with the input.
 *
 * Performance exception: the inner iteration loops (`walkBlocks`, `walkInlines`,
 * plugin iteration) use bracket-indexed access `arr[i]` rather than `for...of`
 * because these run once per token on every streaming chunk. `for...of`
 * allocates an iterator object per call; bracket access avoids that allocation.
 * Each loop is guarded by an immediately-preceding `arr.length` check so the
 * index is strictly in-bounds without any per-element null check.
 *
 * @module walk
 */
import {
  type BlockquoteToken,
  type EmToken,
  type HeadingToken,
  type InlineToken,
  type LinkToken,
  type ListItemToken,
  type ListToken,
  type ParagraphToken,
  type StrikethroughToken,
  type StrongToken,
  type TableToken,
  TOKEN_SCHEMA_VERSION,
  type Token,
  type TokensList,
  TokenType,
} from "@streamd/parser";
import { StreamdPluginAbiError } from "./errors";
import { pluginsErrorMessage } from "./messages";
import type { ApplyPluginsOptions, ApplyPluginsResult, Plugin, PluginContext } from "./types";

/** Public caller name attached to every thrown error for diagnostic text. */
const APPLY_PLUGINS_CALLER = "applyPlugins";

/**
 * Visitor return contract:
 *  - `undefined` — keep token as-is
 *  - `null` — drop the token from the output list
 *  - `Token` — replace with the returned token
 */
export type VisitResult = Token | null | undefined;

/** Inline-only visitor result (mirrors VisitResult but scoped to inline tokens). */
export type InlineVisitResult = InlineToken | null | undefined;

/**
 * Node visitor. `block` is called for every block or inline token; `inline`
 * is called only for inline tokens. Both are optional.
 */
export interface Visitor {
  /** Called for every block-level token (and inline tokens when `inline` is absent). */
  readonly block?: (token: Token) => VisitResult;
  /** Called for every inline token. Takes precedence over `block` for inlines. */
  readonly inline?: (token: InlineToken) => InlineVisitResult;
}

/**
 * Walk a token list depth-first, applying `visitor`.
 *
 * @param tokens - Input list. Not mutated.
 * @param visitor - Visitor with optional `block` and/or `inline` handlers.
 * @returns New list. When no changes occur, the input is returned by reference.
 *   An empty input yields an empty array.
 */
export function walk(tokens: TokensList, visitor: Visitor): TokensList {
  return walkBlocks(tokens, visitor);
}

/**
 * Walk the top-level block sequence and delegate descent per token.
 *
 * @param tokens - Block sequence.
 * @param visitor - Visitor.
 * @returns Possibly-modified block array; input by reference when no changes.
 */
function walkBlocks(tokens: ReadonlyArray<Token>, visitor: Visitor): Array<Token> {
  const out: Array<Token> = [];
  let changed = false;

  for (let i = 0; i < tokens.length; i++) {
    const original = tokens[i];
    const descended = descendBlock(original, visitor);
    const visited = visitor.block ? visitor.block(descended) : undefined;
    const replacement = visited === undefined ? descended : visited;

    if (replacement === null) {
      changed = true;
      continue;
    }

    if (replacement !== original) changed = true;
    out.push(replacement);
  }

  return changed ? out : (tokens as Array<Token>);
}

/**
 * Dispatch descent by block-kind so container tokens recurse into their
 * children before the visitor sees them.
 *
 * @param token - Input token.
 * @param visitor - Visitor.
 * @returns Descended token (child arrays possibly replaced).
 */
function descendBlock(token: Token, visitor: Visitor): Token {
  switch (token.type) {
    case TokenType.Blockquote:
      return descendBlockquote(token, visitor);
    case TokenType.List:
      return descendList(token, visitor);
    case TokenType.ListItem:
      return descendListItem(token, visitor);
    case TokenType.Heading:
      return descendHeading(token, visitor);
    case TokenType.Paragraph:
      return descendParagraph(token, visitor);
    case TokenType.Table:
      return descendTable(token, visitor);
    case TokenType.Em:
    case TokenType.Strong:
    case TokenType.Strikethrough:
    case TokenType.Link:
      return descendInline(token as InlineToken, visitor);
    default:
      return token;
  }
}

/**
 * Recurse into a blockquote's children and rebuild the token only if they
 * changed.
 */
function descendBlockquote(token: BlockquoteToken, visitor: Visitor): BlockquoteToken {
  const children = walkBlocks(token.children, visitor);
  if (children === token.children) return token;
  return { ...token, children };
}

/** Recurse into list items; rebuild the list only when any item changed. */
function descendList(token: ListToken, visitor: Visitor): ListToken {
  let changed = false;
  const items = new Array<ListItemToken>(token.children.length);

  for (let i = 0; i < token.children.length; i++) {
    const originalItem = token.children[i];
    const next = descendListItem(originalItem, visitor);
    if (next !== originalItem) changed = true;
    items[i] = next;
  }

  if (!changed) return token;
  return { ...token, children: items };
}

/** Recurse into a list item's children and rebuild only if they changed. */
function descendListItem(token: ListItemToken, visitor: Visitor): ListItemToken {
  const children = walkBlocks(token.children, visitor);
  if (children === token.children) return token;
  return { ...token, children };
}

/** Recurse into a heading's inline children. */
function descendHeading(token: HeadingToken, visitor: Visitor): HeadingToken {
  const children = walkInlines(token.children, visitor);
  if (children === token.children) return token;
  return { ...token, children };
}

/** Recurse into a paragraph's inline children. */
function descendParagraph(token: ParagraphToken, visitor: Visitor): ParagraphToken {
  const children = walkInlines(token.children, visitor);
  if (children === token.children) return token;
  return { ...token, children };
}

/**
 * Recurse into every cell of a table. Rebuild only if any cell's inline
 * sequence actually changed.
 */
function descendTable(token: TableToken, visitor: Visitor): TableToken {
  const nextHead = rebuildRow(token.head, visitor);
  const nextRows = rebuildRows(token.rows, visitor);
  if (nextHead === token.head && nextRows === token.rows) return token;
  return { ...token, head: nextHead, rows: nextRows };
}

/** Rebuild a single table row (array of cells). */
function rebuildRow(
  row: ReadonlyArray<ReadonlyArray<InlineToken>>,
  visitor: Visitor,
): Array<Array<InlineToken>> {
  const out = new Array<Array<InlineToken>>(row.length);
  let changed = false;

  for (let i = 0; i < row.length; i++) {
    const cell = row[i];
    const nextCell = walkInlines(cell, visitor);
    if (nextCell !== cell) changed = true;
    out[i] = nextCell;
  }

  return changed ? out : (row as Array<Array<InlineToken>>);
}

/** Rebuild every row of a table. */
function rebuildRows(
  rows: ReadonlyArray<ReadonlyArray<ReadonlyArray<InlineToken>>>,
  visitor: Visitor,
): Array<Array<Array<InlineToken>>> {
  const out = new Array<Array<Array<InlineToken>>>(rows.length);
  let changed = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nextRow = rebuildRow(row, visitor);
    if (nextRow !== row) changed = true;
    out[i] = nextRow;
  }

  return changed ? out : (rows as Array<Array<Array<InlineToken>>>);
}

/**
 * Walk an inline sequence, calling the inline visitor (or block visitor as
 * fallback) for each element.
 */
function walkInlines(tokens: ReadonlyArray<InlineToken>, visitor: Visitor): Array<InlineToken> {
  const out: Array<InlineToken> = [];
  let changed = false;

  for (let i = 0; i < tokens.length; i++) {
    const original = tokens[i];
    const descended = descendInline(original, visitor);
    const visited = runInlineVisitor(descended, visitor);
    const replacement = visited === undefined ? descended : visited;

    if (replacement === null) {
      changed = true;
      continue;
    }

    if (replacement !== original) changed = true;
    out.push(replacement);
  }

  return changed ? out : (tokens as Array<InlineToken>);
}

/** Dispatch the inline visitor, falling back to the block visitor if needed. */
function runInlineVisitor(token: InlineToken, visitor: Visitor): InlineVisitResult {
  if (visitor.inline) return visitor.inline(token);
  if (visitor.block) return visitor.block(token) as InlineVisitResult;
  return undefined;
}

/** Recurse into any inline token that has children. */
function descendInline(token: InlineToken, visitor: Visitor): InlineToken {
  switch (token.type) {
    case TokenType.Em:
      return descendInlineChildren(token, visitor);
    case TokenType.Strong:
      return descendInlineChildren(token, visitor);
    case TokenType.Strikethrough:
      return descendInlineChildren(token, visitor);
    case TokenType.Link:
      return descendInlineChildren(token, visitor);
    default:
      return token;
  }
}

/**
 * Rebuild an inline container (Em/Strong/Strikethrough/Link) with recursed
 * children. Returns the input token unchanged when children are unchanged.
 */
function descendInlineChildren<T extends EmToken | StrongToken | StrikethroughToken | LinkToken>(
  token: T,
  visitor: Visitor,
): T {
  const children = walkInlines(token.children, visitor);
  if (children === token.children) return token;
  return { ...token, children };
}

/**
 * Run a sequence of plugins over a token list.
 *
 * Plugins run in the order given. Each receives the output of the previous
 * plugin. The meta bag is shared across all plugins and returned alongside
 * the final tokens.
 *
 * @param tokens - Input token list.
 * @param plugins - Ordered plugin list. Empty list returns input unchanged.
 * @param options - Optional parseOptions + pre-populated meta bag.
 * @returns `{ tokens, meta }` where `meta` is the mutated context bag.
 * @throws {StreamdPluginAbiError} For any ABI / ordering / transform failure.
 */
export function applyPlugins(
  tokens: TokensList,
  plugins: ReadonlyArray<Plugin>,
  options: ApplyPluginsOptions = {},
): ApplyPluginsResult {
  assertPluginAbiCompatibility(plugins);

  const meta = options.meta ? { ...options.meta } : {};
  const ctx: PluginContext = {
    meta,
    ...(options.parseOptions ? { parseOptions: options.parseOptions } : {}),
  };

  let current = tokens;
  for (let i = 0; i < plugins.length; i++) {
    current = runPluginTransform(plugins[i], current, ctx);
  }

  return { tokens: current, meta };
}

/**
 * Verify every plugin declares a `requires.tokenSchema` that matches
 * the parser's `TOKEN_SCHEMA_VERSION`.
 *
 * `requires` is mandatory — a missing field produces a
 * `"missing-requires"` error rather than being silently skipped. This
 * is the H5 guardrail: third-party plugins built against an older
 * parser schema fail loud on load instead of emitting undefined
 * output at runtime.
 *
 * @param plugins The plugin list to validate.
 * @throws {StreamdPluginAbiError} With kind `"missing-requires"` when a plugin
 *   omits `requires`, or `"token-schema-mismatch"` when the declared version
 *   does not equal the parser's.
 */
function assertPluginAbiCompatibility(plugins: ReadonlyArray<Plugin>): void {
  for (const plugin of plugins) {
    const requires = plugin.requires;

    if (requires === undefined || requires === null) {
      throw new StreamdPluginAbiError({
        kind: "missing-requires",
        caller: APPLY_PLUGINS_CALLER,
        pluginName: plugin.name,
        message: pluginsErrorMessage.missingRequires(plugin.name),
      });
    }

    if (requires.tokenSchema === TOKEN_SCHEMA_VERSION) continue;

    throw new StreamdPluginAbiError({
      kind: "token-schema-mismatch",
      caller: APPLY_PLUGINS_CALLER,
      pluginName: plugin.name,
      expected: requires.tokenSchema,
      actual: TOKEN_SCHEMA_VERSION,
      message: pluginsErrorMessage.tokenSchemaMismatch(
        plugin.name,
        requires.tokenSchema,
        TOKEN_SCHEMA_VERSION,
      ),
    });
  }
}

/**
 * Invoke a plugin's `transform` with per-plugin error isolation.
 *
 * On throw, the original error is rewrapped as a
 * `StreamdPluginAbiError` with `kind: "transform-failed"`, the plugin
 * name on `pluginName`, and the original error on `cause`. The
 * `cause` preserves the stack and subclass information of the
 * underlying failure for logs / devtools.
 *
 * @param plugin Current plugin.
 * @param tokens Tokens produced by the previous plugin.
 * @param ctx Shared plugin context.
 * @returns Tokens produced by `plugin.transform`.
 * @throws {StreamdPluginAbiError} With kind `"transform-failed"` when the
 *   plugin's transform throws anything.
 */
function runPluginTransform(plugin: Plugin, tokens: TokensList, ctx: PluginContext): TokensList {
  try {
    return plugin.transform(tokens, ctx);
  } catch (err) {
    throw new StreamdPluginAbiError({
      kind: "transform-failed",
      caller: APPLY_PLUGINS_CALLER,
      pluginName: plugin.name,
      cause: err,
      message: pluginsErrorMessage.transformFailed(plugin.name, extractErrorMessage(err)),
    });
  }
}

/** Return a best-effort human-readable message for any thrown value. */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

/**
 * Compose a list of plugins into a single plugin that runs them in sequence.
 * Useful for packaging a bundle as a single object.
 *
 * The composed plugin declares `requires` matching the parser's
 * `TOKEN_SCHEMA_VERSION` — callers never need to supply one themselves.
 *
 * @param name - Human-readable name for the composed plugin.
 * @param plugins - Ordered list to run. Empty list yields an identity plugin.
 * @returns Plugin whose `transform` runs each child in order.
 */
export function composePlugins(name: string, plugins: ReadonlyArray<Plugin>): Plugin {
  return {
    name,
    requires: { tokenSchema: TOKEN_SCHEMA_VERSION },
    transform(tokens, ctx) {
      let current = tokens;

      for (let i = 0; i < plugins.length; i++) {
        current = plugins[i].transform(current, ctx);
      }

      return current;
    },
  };
}
