/**
 * React Native renderer — walks a token tree and produces RN nodes.
 *
 * @module render
 */
import {
  type BlockquoteToken,
  type CodeBlockToken,
  type CodeSpanToken,
  type EmToken,
  type EscapeToken,
  type HeadingToken,
  type HtmlBlockToken,
  type HtmlInlineToken,
  type ImageToken,
  type InlineToken,
  type LinkToken,
  type ListItemToken,
  type ListToken,
  type MathBlockToken,
  type MathInlineToken,
  type ParagraphToken,
  type StrikethroughToken,
  type StrongToken,
  type TableToken,
  type TextToken,
  type Token,
  type TokensList,
  TokenType,
} from "@streamd/parser";
import { applyPlugins } from "@streamd/plugins";
import { lightTheme, type Theme } from "@streamd/tokens";
import { createElement, Fragment, type ReactNode } from "react";
import { createDefaultComponents } from "./components";
import { reactNativeErrorMessage } from "./messages";
import type { Components, RenderReactNativeOptions } from "./types";
import { assertTokenList, StreamdReactNativeArgumentError } from "./validation";

/**
 * Throws on an unexpected token kind — the token tree is malformed or
 * out of sync with the `@streamd/parser` `TokenType` enum.
 *
 * @param token - The offending token; its `.type` is stringified into the message.
 * @param context - The renderer callsite (e.g. `"renderBlock"`).
 * @throws {StreamdReactNativeArgumentError} Always; `kind = "unknown-token-type"`.
 */
function unreachableToken(token: Token, context: string): never {
  throw new StreamdReactNativeArgumentError({
    kind: "unknown-token-type",
    caller: context,
    message: reactNativeErrorMessage.unexpectedTokenKind(context, String(token.type)),
  });
}

/**
 * Fully resolved renderer options used by the internal React Native render
 * pipeline. Produced once by `renderMarkdown()` from the caller's
 * `RenderOptions`; held as a frozen shape for monomorphic access.
 *
 * `components` is `Required<Components>` — every key is guaranteed present
 * because {@link resolveComponents} merges caller overrides on top of the
 * frozen default set, which defines a component for every token kind.
 */
interface Resolved {
  /** Complete component map — every token kind has a guaranteed entry. */
  readonly components: Required<Components>;
  /** Math rendering mode forwarded from caller options. */
  readonly math: "span-class" | "tex-delim" | "none";
  /** Task-list checkbox rendering mode. */
  readonly taskListCheckboxes: "disabled" | "none";
  /** Global link-press handler, or `undefined` when not provided. */
  readonly onLinkPress: ((href: string) => void) | undefined;
  /** Active theme tokens for styling. */
  readonly theme: Theme;
  /** Whether custom code-block overrides may consume plugin-supplied HTML. */
  readonly allowDangerousMetaHtml: boolean;
}

/** Cache default components per theme reference. */
const DEFAULTS_CACHE = new WeakMap<Theme, Required<Components>>();

/**
 * Returns the default component set for a given theme, caching by reference.
 *
 * The returned map defines a component for every key in {@link Components},
 * so the type is narrowed to `Required<Components>` — callers can access
 * any field without a null check.
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
 * Merge caller-supplied component overrides on top of the frozen default
 * set and return a `Required<Components>`.
 *
 * The `as Required<Components>` cast is sound because `defaults` already
 * supplies a component for every key, and the spread only ever overrides
 * them with caller-supplied concrete components (never with `undefined`
 * under `exactOptionalPropertyTypes`). All consumer code can then access
 * `components.X` without a null assertion.
 *
 * @param defaults - Frozen default component map — complete by construction.
 * @param custom - Optional caller overrides; any key omitted keeps the default.
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
 * @param tokens - Token list from `parse()`. Must be an array — any other
 *   type throws `StreamdReactNativeArgumentError`.
 * @param options - Optional overrides. `theme` defaults to lightTheme.
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
    allowDangerousMetaHtml: options.allowDangerousMetaHtml === true,
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
 * @param keyPrefix - Prefix for React keys to ensure uniqueness.
 * @returns Array of rendered React nodes, one per token.
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
    case TokenType.Blockquote:
      return renderBlockquote(token, resolved, key);
    case TokenType.List:
      return renderList(token, resolved, key);
    case TokenType.ListItem:
      return renderListItem(token, resolved, false, 0, 1, key);
    case TokenType.Heading:
      return renderHeading(token, resolved, key);
    case TokenType.Paragraph:
      return renderParagraph(token, resolved, key);
    case TokenType.CodeBlock:
      return renderCodeBlock(token, resolved, key);
    case TokenType.HtmlBlock:
      return renderHtmlBlock(token, resolved, key);
    case TokenType.Hr:
      return renderHr(resolved, key);
    case TokenType.Space:
      return null;
    case TokenType.Table:
      return renderTable(token, resolved, key);
    case TokenType.MathBlock:
      return renderMathBlock(token, resolved, key);
    default:
      return unreachableToken(token, "renderBlock");
  }
}

/**
 * Renders a blockquote token with its nested children.
 *
 * @param token - The blockquote token containing child blocks.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node wrapping the blockquote content.
 */
function renderBlockquote(token: BlockquoteToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.blockquote;
  return createElement(Component, { key }, ...renderBlocks(token.children, resolved, `${key}-c`));
}

/**
 * Renders an ordered or unordered list token with all its items.
 *
 * @param token - The list token containing child list items.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
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
 * Renders a single list item with its position and checked state.
 *
 * @param token - The list item token containing child blocks.
 * @param resolved - Resolved rendering configuration.
 * @param ordered - Whether the parent list is ordered.
 * @param index - Zero-based index of this item within the list.
 * @param start - Starting number for ordered lists.
 * @param key - React key for the rendered element.
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
  const Component = resolved.components.listItem;
  return createElement(
    Component,
    { key, index, ordered, start, checked: token.checked },
    ...renderBlocks(token.children, resolved, `${key}-b`),
  );
}

/**
 * Renders a heading token at the specified level with inline children.
 *
 * @param token - The heading token with level and inline children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
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
 * Renders a paragraph token with its inline children.
 *
 * @param token - The paragraph token containing inline tokens.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node representing the paragraph.
 */
function renderParagraph(token: ParagraphToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.paragraph;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Props passed to the code-block component during rendering.
 * Extracted from the inline type to satisfy type-centralization rules.
 */
interface CodeBlockRenderProps {
  /** React key for the rendered element. */
  readonly key: string;
  /** Language identifier from the info string. */
  readonly lang: string;
  /** Full info string after the opening fence. */
  readonly info: string;
  /** Raw code content without fences. */
  readonly content: string;
  /** Pre-rendered HTML from a highlight plugin, if present. */
  readonly html?: string;
  /** Whether the component may consume `html`. */
  readonly allowDangerousMetaHtml: boolean;
}

/**
 * Renders a fenced or indented code block with language and info metadata.
 *
 * @param token - The code block token with lang, info, and content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node representing the code block.
 */
function renderCodeBlock(token: CodeBlockToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.codeBlock;
  const htmlValue = token.meta?.html;
  const props: CodeBlockRenderProps =
    htmlValue === undefined
      ? {
          key,
          lang: token.lang,
          info: token.info,
          content: token.content,
          allowDangerousMetaHtml: resolved.allowDangerousMetaHtml,
        }
      : {
          key,
          lang: token.lang,
          info: token.info,
          content: token.content,
          html: htmlValue,
          allowDangerousMetaHtml: resolved.allowDangerousMetaHtml,
        };
  return createElement(Component, props);
}

/**
 * Renders a raw HTML block token as a passthrough component.
 *
 * @param token - The HTML block token with raw content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node representing the HTML block.
 */
function renderHtmlBlock(token: HtmlBlockToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.htmlBlock;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders a horizontal rule (thematic break) element.
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node representing the horizontal rule.
 */
function renderHr(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.hr;
  return createElement(Component, { key });
}

/**
 * Renders a table token with header cells, body rows, and column alignment.
 *
 * @param token - The table token with head, rows, and align arrays.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
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
 * Renders a display-math block based on the configured math mode.
 *
 * @param token - The math block token with TeX content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node, a TeX-delimited string, or null when math is disabled.
 */
function renderMathBlock(token: MathBlockToken, resolved: Resolved, key: string): ReactNode {
  if (resolved.math === "none") return null;
  if (resolved.math === "tex-delim") return `$$\n${token.content}$$\n`;
  const Component = resolved.components.mathBlock;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an array of inline tokens into a Fragment of React Native nodes.
 *
 * @param tokens - Inline tokens to render.
 * @param resolved - Resolved rendering configuration.
 * @param keyPrefix - Prefix for React keys to ensure uniqueness.
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
 * @param key - React key for the rendered element.
 * @returns A React node or throws on unknown inline types.
 */
function renderInline(token: InlineToken, resolved: Resolved, key: string): ReactNode {
  switch (token.type) {
    case TokenType.Text:
      return renderText(token, resolved, key);
    case TokenType.Softbreak:
      return renderSoftbreak(resolved, key);
    case TokenType.Hardbreak:
      return renderHardbreak(resolved, key);
    case TokenType.CodeSpan:
      return renderCodeSpan(token, resolved, key);
    case TokenType.Em:
      return renderEm(token, resolved, key);
    case TokenType.Strong:
      return renderStrong(token, resolved, key);
    case TokenType.Strikethrough:
      return renderStrikethrough(token, resolved, key);
    case TokenType.Link:
      return renderLink(token, resolved, key);
    case TokenType.Image:
      return renderImage(token, resolved, key);
    case TokenType.HtmlInline:
      return renderHtmlInline(token, resolved, key);
    case TokenType.Escape:
      return renderEscape(token, resolved, key);
    case TokenType.MathInline:
      return renderMathInline(token, resolved, key);
    default:
      return unreachableToken(token, "renderInline");
  }
}

/**
 * Renders a plain text token.
 *
 * @param token - The text token with string content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node displaying the text content.
 */
function renderText(token: TextToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.text;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders a soft line break (typically collapsed to a space).
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node representing the soft break.
 */
function renderSoftbreak(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.softbreak;
  return createElement(Component, { key });
}

/**
 * Renders a hard line break (forced newline).
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node representing the hard break.
 */
function renderHardbreak(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.hardbreak;
  return createElement(Component, { key });
}

/**
 * Renders an inline code span.
 *
 * @param token - The code span token with text content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node representing the inline code.
 */
function renderCodeSpan(token: CodeSpanToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.codeSpan;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an emphasis (italic) span with inline children.
 *
 * @param token - The emphasis token containing inline children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node wrapping the emphasized content.
 */
function renderEm(token: EmToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.em;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a strong (bold) span with inline children.
 *
 * @param token - The strong token containing inline children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node wrapping the bold content.
 */
function renderStrong(token: StrongToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.strong;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a strikethrough span with inline children.
 *
 * @param token - The strikethrough token containing inline children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
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
 * Renders a hyperlink with optional onPress handler and inline children.
 *
 * @param token - The link token with href, title, and inline children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
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
 * Renders an image element with src, alt text, and optional title.
 *
 * @param token - The image token with src, alt, and title.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node representing the image.
 */
function renderImage(token: ImageToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.image;
  return createElement(Component, { key, src: token.src, alt: token.alt, title: token.title });
}

/**
 * Renders an inline raw HTML fragment as a passthrough component.
 *
 * @param token - The inline HTML token with raw content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node representing the inline HTML.
 */
function renderHtmlInline(token: HtmlInlineToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.htmlInline;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders a backslash-escaped character.
 *
 * @param token - The escape token with the escaped character content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node displaying the escaped character.
 */
function renderEscape(token: EscapeToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.escape;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an inline math expression based on the configured math mode.
 *
 * @param token - The inline math token with TeX content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns A React node, a TeX-delimited string, or null when math is disabled.
 */
function renderMathInline(token: MathInlineToken, resolved: Resolved, key: string): ReactNode {
  if (resolved.math === "none") return null;
  if (resolved.math === "tex-delim") return `$${token.content}$`;
  const Component = resolved.components.mathInline;
  return createElement(Component, { key, content: token.content });
}
