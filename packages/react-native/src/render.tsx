/**
 * React Native renderer — walks a token tree and produces RN nodes.
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
} from "@streamd/parser";
import { applyPlugins } from "@streamd/plugins";
import { lightTheme, type Theme } from "@streamd/tokens";
import { createElement, Fragment, type ReactNode } from "react";
import { createDefaultComponents } from "./components";
import { reactNativeErrorMessage } from "./messages";
import type { Components, RenderReactNativeOptions } from "./types";
import { assertTokenList, StreamdReactNativeArgumentError } from "./validation";

/**
 * Throws on an unexpected token kind.
 *
 * @param token - The offending token.
 * @param context - The renderer callsite.
 * @throws {StreamdReactNativeArgumentError} Always.
 */
function unreachableToken(token: Token, context: string): never {
  throw new StreamdReactNativeArgumentError({
    kind: "unknown-token-type",
    caller: context,
    message: reactNativeErrorMessage.unexpectedTokenKind(context, String(token.type)),
  });
}

/**
 * Fully resolved renderer options used by the internal render pipeline.
 */
interface Resolved {
  /** Complete component map — every token kind has a guaranteed entry. */
  readonly components: Required<Components>;
  /** Math rendering mode. */
  readonly math: "span-class" | "tex-delim" | "none";
  /** Task-list checkbox rendering mode. */
  readonly taskListCheckboxes: "disabled" | "none";
  /** Global link-press handler. */
  readonly onLinkPress: ((href: string) => void) | undefined;
  /** Active theme tokens. */
  readonly theme: Theme;
}

/** Cache default components per theme reference. */
const DEFAULTS_CACHE = new WeakMap<Theme, Required<Components>>();

/**
 * Returns the default component set for a given theme, caching by reference.
 *
 * @param theme - The theme to build defaults for.
 * @returns Cached or freshly-built default components.
 */
function defaultsFor(theme: Theme): Required<Components> {
  const cached = DEFAULTS_CACHE.get(theme);
  if (cached) return cached;
  const built = createDefaultComponents(theme);
  DEFAULTS_CACHE.set(theme, built);
  return built;
}

/**
 * Merge caller-supplied component overrides on top of the default set.
 *
 * @param defaults - Frozen default component map.
 * @param custom - Optional caller overrides.
 * @returns Merged component map with every field guaranteed present.
 */
function resolveComponents(
  defaults: Required<Components>,
  custom: Components | undefined,
): Required<Components> {
  if (!custom) return defaults;
  return { ...defaults, ...custom } as Required<Components>;
}

/**
 * Render a token tree to React Native nodes.
 *
 * @param tokens - Token list from `parse()`.
 * @param options - Optional overrides.
 * @throws StreamdReactNativeArgumentError when `tokens` is not an array.
 */
export function renderReactNative(
  tokens: TokensList,
  options: RenderReactNativeOptions = {},
): ReactNode {
  assertTokenList(tokens, "renderReactNative");
  const theme = options.theme ?? lightTheme;
  const defaults = defaultsFor(theme);
  const resolved: Resolved = {
    components: resolveComponents(defaults, options.components),
    math: options.math ?? "span-class",
    taskListCheckboxes: options.taskListCheckboxes ?? "disabled",
    onLinkPress: options.onLinkPress,
    theme,
  };
  const effective =
    options.plugins && options.plugins.length > 0
      ? applyPlugins(tokens, options.plugins).tokens
      : tokens;
  if (effective.length === 0) return null;
  return createElement(Fragment, null, ...renderBlocks(effective, resolved, "b"));
}

/**
 * Renders an array of block-level tokens into React Native nodes.
 *
 * @param tokens - Block tokens to render.
 * @param resolved - Resolved rendering configuration.
 * @param keyPrefix - Prefix for React keys.
 * @returns Array of rendered React nodes.
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
 * Dispatches a single block-level token to its type-specific renderer.
 *
 * @param token - The block token to render.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node, null for space tokens, or throws on unknown types.
 */
function renderBlock(token: Token, resolved: Resolved, key: string): ReactNode {
  switch (token.type) {
    case "blockquote":
      return renderBlockquote(token, resolved, key);
    case "list":
      return renderList(token, resolved, key);
    case "list_item":
      return renderListItem(token, resolved, false, 0, 1, key);
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
      return unreachableToken(token, "renderBlock");
  }
}

/**
 * Renders a blockquote token with its nested children.
 *
 * @param token - The blockquote token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node wrapping the blockquote content.
 */
function renderBlockquote(token: BlockquoteToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.blockquote;
  return createElement(Component, { key }, ...renderBlocks(token.children, resolved, `${key}-c`));
}

/**
 * Renders a list token with all its items.
 *
 * @param token - The list token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the full list.
 */
function renderList(token: ListToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.list;
  const items = new Array<ReactNode>(token.children.length);
  for (let i = 0; i < token.children.length; i++) {
    items[i] = renderListItem(
      token.children[i],
      resolved,
      token.ordered,
      i,
      token.start,
      `${key}-i${i}`,
    );
  }
  return createElement(
    Component,
    { key, ordered: token.ordered, start: token.start, tight: token.tight },
    ...items,
  );
}

/**
 * Renders a single list item.
 *
 * @param token - The list item token.
 * @param resolved - Resolved rendering configuration.
 * @param ordered - Whether the parent list is ordered.
 * @param index - Zero-based index.
 * @param start - Starting number for ordered lists.
 * @param key - React key.
 * @returns A React node representing the list item.
 */
function renderListItem(
  token: ListItemToken,
  resolved: Resolved,
  ordered: boolean,
  index: number,
  start: number,
  key: string,
): ReactNode {
  const Component = resolved.components.list_item;
  return createElement(
    Component,
    { key, index, ordered, start, checked: token.checked },
    ...renderBlocks(token.children, resolved, `${key}-b`),
  );
}

/**
 * Renders a heading token.
 *
 * @param token - The heading token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the heading.
 */
function renderHeading(token: HeadingToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.heading;
  return createElement(
    Component,
    { key, level: token.level },
    renderInlines(token.children, resolved, `${key}-i`),
  );
}

/**
 * Renders a paragraph token.
 *
 * @param token - The paragraph token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the paragraph.
 */
function renderParagraph(token: ParagraphToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.paragraph;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a code block with optional structured highlight data.
 *
 * @param token - The code block token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the code block.
 */
function renderCodeBlock(token: CodeBlockToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.code_block;
  const highlight = token.meta?.highlight;
  const props = highlight
    ? { key, lang: token.lang, content: token.content, highlight }
    : { key, lang: token.lang, content: token.content };
  return createElement(Component, props);
}

/**
 * Renders a horizontal rule.
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the horizontal rule.
 */
function renderHr(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.hr;
  return createElement(Component, { key });
}

/**
 * Renders a table token.
 *
 * @param token - The table token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the table.
 */
function renderTable(token: TableToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.table;
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
 * Renders a display-math block.
 *
 * @param token - The math block token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node, TeX-delimited string, or null.
 */
function renderMathBlock(token: MathBlockToken, resolved: Resolved, key: string): ReactNode {
  if (resolved.math === "none") return null;
  if (resolved.math === "tex-delim") return `$$\n${token.content}$$\n`;
  const Component = resolved.components.math_block;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an array of inline tokens into a Fragment.
 *
 * @param tokens - Inline tokens to render.
 * @param resolved - Resolved rendering configuration.
 * @param keyPrefix - Prefix for React keys.
 * @returns A Fragment wrapping all inline nodes, or null when empty.
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
 * @param token - The inline token to render.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node or throws on unknown inline types.
 */
function renderInline(token: InlineToken, resolved: Resolved, key: string): ReactNode {
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
 * Renders a plain text token.
 *
 * @param token - The text token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node displaying the text content.
 */
function renderText(token: TextToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.text;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders a hard line break.
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the hard break.
 */
function renderHardbreak(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.hardbreak;
  return createElement(Component, { key });
}

/**
 * Renders an inline code span.
 *
 * @param token - The code span token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the inline code.
 */
function renderCodeSpan(token: CodeSpanToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.code_span;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an emphasis span.
 *
 * @param token - The emphasis token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node wrapping the emphasized content.
 */
function renderEm(token: EmToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.em;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a strong span.
 *
 * @param token - The strong token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node wrapping the bold content.
 */
function renderStrong(token: StrongToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.strong;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a strikethrough span.
 *
 * @param token - The strikethrough token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node wrapping the struck-through content.
 */
function renderStrikethrough(
  token: StrikethroughToken,
  resolved: Resolved,
  key: string,
): ReactNode {
  const Component = resolved.components.strikethrough;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a hyperlink.
 *
 * @param token - The link token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the link.
 */
function renderLink(token: LinkToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.link;
  const props = resolved.onLinkPress
    ? { key, href: token.href, title: token.title, onPress: resolved.onLinkPress }
    : { key, href: token.href, title: token.title };
  return createElement(Component, props, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders an image element.
 *
 * @param token - The image token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node representing the image.
 */
function renderImage(token: ImageToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.image;
  return createElement(Component, { key, src: token.src, alt: token.alt, title: token.title });
}

/**
 * Renders a backslash-escaped character.
 *
 * @param token - The escape token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node displaying the escaped character.
 */
function renderEscape(token: EscapeToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.escape;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an inline math expression.
 *
 * @param token - The inline math token.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key.
 * @returns A React node, TeX-delimited string, or null.
 */
function renderMathInline(token: MathInlineToken, resolved: Resolved, key: string): ReactNode {
  if (resolved.math === "none") return null;
  if (resolved.math === "tex-delim") return `$${token.content}$`;
  const Component = resolved.components.math_inline;
  return createElement(Component, { key, content: token.content });
}
