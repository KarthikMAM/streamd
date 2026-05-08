/**
 * React renderer — walks a streamd token tree and produces React nodes.
 *
 * Stateless, synchronous. Custom components can override any token type
 * via the `ReactComponents` map keyed by `TokenTypeValue`.
 *
 * @module render
 */
import type {
  BlockquoteToken,
  CodeBlockToken,
  CodeSpanToken,
  EmToken,
  EscapeToken,
  HeadingToken,
  ImageToken,
  InlineToken,
  LinkToken,
  ListItemToken,
  ListToken,
  MathBlockToken,
  MathInlineToken,
  ParagraphToken,
  StrikethroughToken,
  StrongToken,
  TableToken,
  TextToken,
  Token,
  TokensList,
  TokenTypeValue,
} from "@streamd/parser";
import { applyPlugins, type Plugin } from "@streamd/plugins";
import { createElement, Fragment, type ReactNode } from "react";
import { createDefaultComponents, type DefaultComponents } from "./components";
import { decodeEntities } from "./escape";
import { MemoBlock } from "./memo-block";
import { reactErrorMessage } from "./messages";
import type { ReactComponents, RenderReactOptions } from "./types";
import { assertTokenList, StreamdReactArgumentError } from "./validation";

/**
 * Throws on an unexpected token kind — the token tree is malformed or
 * out of sync with the parser's `TokenType` constants.
 *
 * @param token - The offending token.
 * @param context - The renderer callsite (e.g. `"renderBlock"`).
 * @throws {StreamdReactArgumentError} Always; `kind = "unknown-token-type"`.
 */
function unreachableToken(token: Token, context: string): never {
  throw new StreamdReactArgumentError({
    kind: "unknown-token-type",
    caller: context,
    message: reactErrorMessage.unexpectedTokenKind(context, String(token.type)),
  });
}

/**
 * Fully resolved renderer options used by the internal render pipeline.
 * Produced once by `renderReact()` from the caller's `RenderReactOptions`.
 */
interface Resolved {
  /** Default component map — every token kind has a concrete component. */
  readonly defaults: DefaultComponents;
  /** Consumer-supplied overrides keyed by token type string. */
  readonly overrides: ReactComponents | undefined;
  /** Active math rendering strategy. */
  readonly math: "span-class" | "tex-delim" | "none";
  /** Active task-list checkbox strategy. */
  readonly taskListCheckboxes: "disabled" | "none";
}

/** Default CSS class prefix. */
const DEFAULT_PREFIX = "streamd";

/** Cache of default component maps keyed by class prefix. */
const DEFAULTS_CACHE = new Map<string, DefaultComponents>();

/**
 * Returns the default component map for a given class prefix, using a cache.
 *
 * @param prefix - CSS class prefix string.
 * @returns Cached or freshly-built default component map.
 */
function defaultComponentsFor(prefix: string): DefaultComponents {
  const cached = DEFAULTS_CACHE.get(prefix);
  if (cached) return cached;
  const built = createDefaultComponents(prefix);
  DEFAULTS_CACHE.set(prefix, built);
  return built;
}

/**
 * Render a token tree to React nodes.
 *
 * Returns a Fragment containing one child per top-level token, each
 * wrapped in a `<MemoBlock>` for reference-stable memoisation.
 *
 * @param tokens - Token list from `parse()`.
 * @param options - Optional component overrides, rendering flags, and plugins.
 * @returns A React Fragment, or `null` when the token list is empty.
 * @throws StreamdReactArgumentError when `tokens` is not an array.
 */
export function renderReact(tokens: TokensList, options: RenderReactOptions = {}): ReactNode {
  assertTokenList(tokens, "renderReact");
  const prefix = options.classPrefix ?? DEFAULT_PREFIX;
  const defaults = defaultComponentsFor(prefix);
  const resolved: Resolved = {
    defaults,
    overrides: options.components,
    math: options.math ?? "span-class",
    taskListCheckboxes: options.taskListCheckboxes ?? "disabled",
  };
  const effective =
    options.plugins && options.plugins.length > 0
      ? applyPlugins(tokens, options.plugins as ReadonlyArray<Plugin>).tokens
      : tokens;
  if (effective.length === 0) return null;
  const children = new Array<ReactNode>(effective.length);
  for (let i = 0; i < effective.length; i++) {
    children[i] = createElement(MemoBlock, {
      key: `b-${i}`,
      token: effective[i],
      index: i,
      renderToken,
      resolved,
    });
  }
  return createElement(Fragment, null, ...children);
}

/**
 * Top-level render function passed to MemoBlock. Dispatches a single
 * block-level token to its type-specific renderer.
 *
 * @param token - Block-level token to render.
 * @param index - Position index for key generation.
 * @param resolved - Resolved rendering configuration.
 * @returns ReactNode for the block, or null for space tokens.
 */
function renderToken(token: Token, index: number, resolved: object): ReactNode {
  const r = resolved as Resolved;
  const key = `b-${index}`;

  if (r.overrides) {
    const Override = r.overrides[token.type as TokenTypeValue] as
      | React.ComponentType<{ token: Token; children?: ReactNode }>
      | undefined;
    if (Override) {
      const children = renderDefaultChildren(token, r);
      return createElement(Override, { key, token, children });
    }
  }

  return renderBlock(token, r, key);
}

/**
 * Renders the default children for a token (used when passing to overrides).
 *
 * @param token - Token whose children to render.
 * @param resolved - Resolved rendering configuration.
 * @returns ReactNode of the default-rendered children, or undefined.
 */
function renderDefaultChildren(token: Token, resolved: Resolved): ReactNode | undefined {
  switch (token.type) {
    case "blockquote":
      return renderBlocksFragment(token.children, resolved, "oc");
    case "list":
      return undefined;
    case "list_item":
      return undefined;
    case "heading":
      return renderInlines(token.children, resolved, "oc");
    case "paragraph":
      return renderInlines(token.children, resolved, "oc");
    case "em":
    case "strong":
    case "strikethrough":
      return renderInlines(token.children, resolved, "oc");
    case "link":
      return renderInlines(token.children, resolved, "oc");
    default:
      return undefined;
  }
}

/**
 * Dispatches a single block-level token to its type-specific renderer.
 *
 * @param token - Block-level token to render.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the block, or null for space tokens.
 */
function renderBlock(token: Token, resolved: Resolved, key: string): ReactNode {
  switch (token.type) {
    case "blockquote":
      return renderBlockquote(token, resolved, key);
    case "list":
      return renderList(token, resolved, key);
    case "list_item":
      return renderListItem(token, resolved, false, key);
    case "heading":
      return renderHeading(token, resolved, key);
    case "paragraph":
      return renderParagraph(token, resolved, key);
    case "code_block":
      return renderCodeBlock(token, resolved, key);
    case "hr":
      return renderHr(resolved, key);
    case "space":
      return null;
    case "table":
      return renderTable(token, resolved, key);
    case "math_block":
      return renderMathBlock(token, resolved, key);
    default:
      return renderInline(token as InlineToken, resolved, key);
  }
}

/**
 * Renders a blockquote token.
 *
 * @param token - Blockquote token containing child block tokens.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode wrapping the blockquote children.
 */
function renderBlockquote(token: BlockquoteToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.blockquote;
  return createElement(Component, { key }, ...renderBlocks(token.children, resolved, `${key}-c`));
}

/**
 * Renders a list token (ordered or unordered).
 *
 * @param token - List token containing list-item children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the list.
 */
function renderList(token: ListToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.list;
  const items = new Array<ReactNode>(token.children.length);
  for (let i = 0; i < token.children.length; i++) {
    items[i] = renderListItem(token.children[i], resolved, token.tight, `${key}-i${i}`);
  }
  return createElement(
    Component,
    { key, ordered: token.ordered, start: token.start, tight: token.tight },
    ...items,
  );
}

/**
 * Renders a list item token.
 *
 * @param token - List item token.
 * @param resolved - Resolved rendering configuration.
 * @param tight - Whether the parent list is tight.
 * @param key - React key.
 * @returns ReactNode for the list item.
 */
function renderListItem(
  token: ListItemToken,
  resolved: Resolved,
  tight: boolean,
  key: string,
): ReactNode {
  const Component = resolved.defaults.listItem;
  const body = renderListItemBody(token, resolved, tight, key);
  return createElement(Component, { key, checked: token.checked, tight }, body);
}

/**
 * Renders the body content of a list item, handling tight-list paragraph unwrapping.
 *
 * @param token - List item token.
 * @param resolved - Resolved rendering configuration.
 * @param tight - Whether the parent list is tight.
 * @param keyPrefix - Prefix for React keys.
 * @returns ReactNode for the list item body.
 */
function renderListItemBody(
  token: ListItemToken,
  resolved: Resolved,
  tight: boolean,
  keyPrefix: string,
): ReactNode {
  if (token.children.length === 0) return null;

  const hasSingleChild = token.children.length === 1;
  if (tight && hasSingleChild && token.children[0].type === "paragraph") {
    return renderInlines(token.children[0].children, resolved, `${keyPrefix}-b`);
  }

  if (tight) {
    const allParagraphs = token.children.every((c) => c.type === "paragraph");
    if (allParagraphs) {
      const parts: Array<ReactNode> = [];
      for (let i = 0; i < token.children.length; i++) {
        if (i > 0) parts.push("\n");
        const p = token.children[i] as ParagraphToken;
        parts.push(
          createElement(
            Fragment,
            { key: `${keyPrefix}-p${i}` },
            renderInlines(p.children, resolved, `${keyPrefix}-p${i}-i`),
          ),
        );
      }
      return createElement(Fragment, null, ...parts);
    }
  }

  return createElement(Fragment, null, ...renderBlocks(token.children, resolved, `${keyPrefix}-b`));
}

/**
 * Renders a heading token.
 *
 * @param token - Heading token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the heading.
 */
function renderHeading(token: HeadingToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.heading;
  const props = token.meta?.id
    ? { key, level: token.level, id: token.meta.id }
    : { key, level: token.level };
  return createElement(Component, props, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a paragraph token.
 *
 * @param token - Paragraph token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the paragraph.
 */
function renderParagraph(token: ParagraphToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.paragraph;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a fenced code block token with optional structured highlighting.
 *
 * @param token - Code block token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the code block.
 */
function renderCodeBlock(token: CodeBlockToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.codeBlock;
  const highlight = token.meta?.highlight;
  return createElement(Component, {
    key,
    lang: token.lang,
    content: token.content,
    ...(highlight ? { highlight } : {}),
  });
}

/**
 * Renders a horizontal rule.
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the hr.
 */
function renderHr(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.hr;
  return createElement(Component, { key });
}

/**
 * Renders a table token.
 *
 * @param token - Table token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the table.
 */
function renderTable(token: TableToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.table;
  const head = new Array<ReactNode>(token.head.length);
  for (let i = 0; i < token.head.length; i++) {
    head[i] = renderInlines(token.head[i], resolved, `${key}-h${i}`);
  }
  const rows = new Array<Array<ReactNode>>(token.rows.length);
  for (let r = 0; r < token.rows.length; r++) {
    const row = token.rows[r];
    const cells = new Array<ReactNode>(row.length);
    for (let c = 0; c < row.length; c++) {
      cells[c] = renderInlines(row[c], resolved, `${key}-r${r}c${c}`);
    }
    rows[r] = cells;
  }
  return createElement(Component, { key, align: token.align, head, rows });
}

/**
 * Renders a display-math block token based on the configured math mode.
 *
 * @param token - Math block token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode, string, or null depending on math mode.
 */
function renderMathBlock(token: MathBlockToken, resolved: Resolved, key: string): ReactNode {
  if (resolved.math === "none") return null;
  if (resolved.math === "tex-delim") return `$$\n${token.content}$$\n`;
  const Component = resolved.defaults.mathBlock;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an array of block-level tokens into React nodes.
 *
 * @param tokens - Array of block-level tokens.
 * @param resolved - Resolved rendering configuration.
 * @param keyPrefix - Prefix for React keys.
 * @returns Array of ReactNode elements.
 */
function renderBlocks(
  tokens: ReadonlyArray<Token>,
  resolved: Resolved,
  keyPrefix: string,
): Array<ReactNode> {
  const out: Array<ReactNode> = new Array(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    out[i] = renderBlock(tokens[i], resolved, `${keyPrefix}-${i}`);
  }
  return out;
}

/**
 * Renders an array of block-level tokens into a Fragment.
 *
 * @param tokens - Array of block-level tokens.
 * @param resolved - Resolved rendering configuration.
 * @param keyPrefix - Prefix for React keys.
 * @returns Fragment containing all block nodes.
 */
function renderBlocksFragment(
  tokens: ReadonlyArray<Token>,
  resolved: Resolved,
  keyPrefix: string,
): ReactNode {
  return createElement(Fragment, null, ...renderBlocks(tokens, resolved, keyPrefix));
}

/**
 * Renders an array of inline tokens into a Fragment.
 *
 * @param tokens - Array of inline tokens.
 * @param resolved - Resolved rendering configuration.
 * @param keyPrefix - Prefix for React keys.
 * @returns Fragment containing all inline nodes, or null if empty.
 */
function renderInlines(
  tokens: ReadonlyArray<InlineToken>,
  resolved: Resolved,
  keyPrefix: string,
): ReactNode {
  if (tokens.length === 0) return null;
  const out = new Array<ReactNode>(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    out[i] = renderInline(tokens[i], resolved, `${keyPrefix}-${i}`);
  }
  return createElement(Fragment, null, ...out);
}

/**
 * Dispatches a single inline token to its type-specific renderer.
 *
 * @param token - Inline token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the inline token.
 */
function renderInline(token: InlineToken, resolved: Resolved, key: string): ReactNode {
  if (resolved.overrides) {
    const Override = resolved.overrides[token.type as TokenTypeValue] as
      | React.ComponentType<{ token: InlineToken; children?: ReactNode }>
      | undefined;
    if (Override) {
      const children = renderInlineDefaultChildren(token, resolved);
      return createElement(Override, { key, token, children });
    }
  }

  switch (token.type) {
    case "text":
      return renderText(token, resolved, key);
    case "hardbreak":
      return renderHardbreak(resolved, key);
    case "code_span":
      return renderCodeSpan(token, resolved, key);
    case "em":
      return renderEm(token, resolved, key);
    case "strong":
      return renderStrong(token, resolved, key);
    case "strikethrough":
      return renderStrikethrough(token, resolved, key);
    case "link":
      return renderLink(token, resolved, key);
    case "image":
      return renderImage(token, resolved, key);
    case "escape":
      return renderEscape(token, resolved, key);
    case "math_inline":
      return renderMathInline(token, resolved, key);
    default:
      return unreachableToken(token, "renderInline");
  }
}

/**
 * Renders default children for an inline token (for override components).
 *
 * @param token - Inline token.
 * @param resolved - Resolved rendering configuration.
 * @returns ReactNode of children, or undefined.
 */
function renderInlineDefaultChildren(
  token: InlineToken,
  resolved: Resolved,
): ReactNode | undefined {
  switch (token.type) {
    case "em":
    case "strong":
    case "strikethrough":
      return renderInlines(token.children, resolved, "ic");
    case "link":
      return renderInlines(token.children, resolved, "ic");
    default:
      return undefined;
  }
}

/**
 * Renders a text token with entity decoding.
 *
 * @param token - Text token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the text.
 */
function renderText(token: TextToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.text;
  return createElement(Component, { key, content: decodeEntities(token.content) });
}

/**
 * Renders a hard line break.
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the break.
 */
function renderHardbreak(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.hardbreak;
  return createElement(Component, { key });
}

/**
 * Renders an inline code span.
 *
 * @param token - Code span token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the code span.
 */
function renderCodeSpan(token: CodeSpanToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.codeSpan;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an emphasis token.
 *
 * @param token - Em token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the emphasis.
 */
function renderEm(token: EmToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.em;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a strong token.
 *
 * @param token - Strong token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the strong.
 */
function renderStrong(token: StrongToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.strong;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a strikethrough token.
 *
 * @param token - Strikethrough token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the strikethrough.
 */
function renderStrikethrough(
  token: StrikethroughToken,
  resolved: Resolved,
  key: string,
): ReactNode {
  const Component = resolved.defaults.strikethrough;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a link token with meta attributes.
 *
 * @param token - Link token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the link.
 */
function renderLink(token: LinkToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.link;
  const props: Record<string, unknown> = {
    key,
    href: token.href,
    title: token.title,
  };
  if (token.meta?.rel) props["rel"] = token.meta.rel;
  if (token.meta?.target) props["target"] = token.meta.target;
  if (token.meta?.className) props["className"] = token.meta.className;
  return createElement(
    Component,
    props as { key: string; href: string; title: string },
    renderInlines(token.children, resolved, `${key}-i`),
  );
}

/**
 * Renders an image token with meta attributes.
 *
 * @param token - Image token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the image.
 */
function renderImage(token: ImageToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.image;
  return createElement(Component, {
    key,
    src: token.src,
    alt: token.alt,
    title: token.title,
    ...(token.meta?.attrs ? { attrs: token.meta.attrs } : {}),
  });
}

/**
 * Renders an escape token.
 *
 * @param token - Escape token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode for the escaped character.
 */
function renderEscape(token: EscapeToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.defaults.escape;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an inline math token based on the configured math mode.
 *
 * @param token - Math inline token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns ReactNode, string, or null depending on math mode.
 */
function renderMathInline(token: MathInlineToken, resolved: Resolved, key: string): ReactNode {
  if (resolved.math === "none") return null;
  if (resolved.math === "tex-delim") return `$${token.content}$`;
  const Component = resolved.defaults.mathInline;
  return createElement(Component, { key, content: token.content });
}
