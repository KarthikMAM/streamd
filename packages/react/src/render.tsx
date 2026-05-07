/**
 * React renderer — walks a streamd token tree and produces React nodes.
 *
 * Stateless, synchronous. Custom components can override any node type via
 * the `components` option.
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
import { applyPlugins, type Plugin } from "@streamd/plugins";
import { createElement, Fragment, type ReactNode } from "react";
import { createDefaultComponents } from "./components";
import { decodeEntities } from "./escape";
import { reactErrorMessage } from "./messages";
import type { Components, RenderReactOptions } from "./types";
import { assertTokenList, StreamdReactArgumentError } from "./validation";

/**
 * Throws on an unexpected token kind — the token tree is malformed or
 * out of sync with the `@streamd/parser` `TokenType` enum.
 *
 * @param token - The offending token; its `.type` is stringified into the message.
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
 * Fully resolved renderer options used by the internal React render
 * pipeline. Produced once by `renderMarkdown()` from the caller's
 * `RenderOptions`; held as a frozen shape for monomorphic access.
 *
 * `components` is `Required<Components>` — every key is guaranteed present
 * because {@link resolveComponents} merges caller overrides on top of the
 * frozen default set, which defines a component for every token kind.
 */
interface Resolved {
  /** Complete component map — every token kind has a concrete component. */
  readonly components: Required<Components>;
  /** Active math rendering strategy. */
  readonly math: "span-class" | "tex-delim" | "none";
  /** Active task-list checkbox strategy. */
  readonly taskListCheckboxes: "disabled" | "none";
  /** Whether plugin-supplied HTML may be rendered via `dangerouslySetInnerHTML`. */
  readonly allowDangerousMetaHtml: boolean;
}

/** Default CSS class prefix — matches the npm package scope (`streamd-*`). */
const DEFAULT_PREFIX = "streamd";

/** Cache of default component maps keyed by class prefix to avoid re-creation. */
const DEFAULTS_CACHE = new Map<string, Required<Components>>();

/**
 * Returns the default component map for a given class prefix, using a cache.
 *
 * The returned map defines a component for every key in {@link Components},
 * so the type is narrowed to `Required<Components>` — callers can access
 * any field without a null check.
 *
 * @param prefix - CSS class prefix string used to namespace generated class names.
 * @returns Cached or freshly-built default component map.
 */
function defaultComponentsFor(prefix: string): Required<Components> {
  const cached = DEFAULTS_CACHE.get(prefix);
  if (cached) return cached;
  const built = createDefaultComponents(prefix);
  DEFAULTS_CACHE.set(prefix, built);
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
 * Render a token tree to React nodes.
 *
 * Returns a Fragment containing one child per top-level token.
 *
 * @param tokens - Token list from `parse()`. Must be an array — any other
 *   type throws `StreamdReactArgumentError`.
 * @param options - Optional component overrides, rendering flags, and plugins.
 * @returns A React Fragment containing one child per top-level token, or
 *   `null` when the token list is empty.
 * @throws StreamdReactArgumentError when `tokens` is not an array.
 */
export function renderReact(tokens: TokensList, options: RenderReactOptions = {}): ReactNode {
  assertTokenList(tokens, "renderReact");
  const prefix = options.classPrefix ?? DEFAULT_PREFIX;
  const defaults = defaultComponentsFor(prefix);
  const resolved: Resolved = {
    components: resolveComponents(defaults, options.components),
    math: options.math ?? "span-class",
    taskListCheckboxes: options.taskListCheckboxes ?? "disabled",
    allowDangerousMetaHtml: options.allowDangerousMetaHtml === true,
  };
  const effective =
    options.plugins && options.plugins.length > 0
      ? applyPlugins(tokens, options.plugins as ReadonlyArray<Plugin>).tokens
      : tokens;
  if (effective.length === 0) return null;
  return createElement(Fragment, null, ...renderBlocks(effective, resolved, "b"));
}

/**
 * Renders an array of block-level tokens into React nodes.
 *
 * @param tokens - Array of block-level tokens to render.
 * @param resolved - Resolved rendering configuration (components, math mode, etc.).
 * @param keyPrefix - Prefix for React keys to ensure uniqueness.
 * @returns Array of ReactNode elements, one per input token.
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
 * @param token - Block-level token to render.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the block, or null for space tokens.
 * @throws Error via unreachableToken if the token type is unknown.
 */
function renderBlock(token: Token, resolved: Resolved, key: string): ReactNode {
  switch (token.type) {
    case TokenType.Blockquote:
      return renderBlockquote(token, resolved, key);
    case TokenType.List:
      return renderList(token, resolved, key);
    case TokenType.ListItem:
      return renderListItem(token, resolved, false, key);
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
 * Renders a blockquote token into a React element using the configured component.
 *
 * @param token - Blockquote token containing child block tokens.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode wrapping the blockquote children.
 */
function renderBlockquote(token: BlockquoteToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.blockquote;
  return createElement(Component, { key }, ...renderBlocks(token.children, resolved, `${key}-c`));
}

/**
 * Renders a list token (ordered or unordered) into a React element.
 *
 * @param token - List token containing list-item children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the list with all items rendered.
 */
function renderList(token: ListToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.list;
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
 * Renders a list item token into a React element with optional checkbox state.
 *
 * @param token - List item token with children and optional checked state.
 * @param resolved - Resolved rendering configuration.
 * @param tight - Whether the parent list is tight (affects paragraph wrapping).
 * @param key - React key for the rendered element.
 * @returns ReactNode for the list item.
 */
function renderListItem(
  token: ListItemToken,
  resolved: Resolved,
  tight: boolean,
  key: string,
): ReactNode {
  const Component = resolved.components.listItem;
  const body = renderListItemBody(token, resolved, tight, key);
  return createElement(Component, { key, checked: token.checked, tight }, body);
}

/**
 * Renders the body content of a list item, handling tight-list paragraph unwrapping.
 *
 * In tight lists, single-paragraph items are unwrapped to inline content.
 * Multi-paragraph tight items are joined with newline separators.
 *
 * @param token - List item token whose body to render.
 * @param resolved - Resolved rendering configuration.
 * @param tight - Whether the parent list is tight.
 * @param keyPrefix - Prefix for React keys within the body.
 * @returns ReactNode for the list item body, or null if empty.
 */
function renderListItemBody(
  token: ListItemToken,
  resolved: Resolved,
  tight: boolean,
  keyPrefix: string,
): ReactNode {
  const hasSingleChild = token.children.length === 1;
  const isTightSingleChild = tight && hasSingleChild;
  if (isTightSingleChild) {
    const only = token.children[0];
    if (only.type === TokenType.Paragraph) {
      return renderInlines(only.children, resolved, `${keyPrefix}-b`);
    }
  }

  if (token.children.length === 0) return null;

  if (tight) {
    const allParagraphs = token.children.every((c) => c.type === TokenType.Paragraph);
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
 * Renders a heading token into a React element with level and optional id.
 *
 * @param token - Heading token with level (1–6), children, and optional meta.id.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the heading.
 */
function renderHeading(token: HeadingToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.heading;
  const props = token.meta?.id
    ? { key, level: token.level, id: token.meta.id }
    : { key, level: token.level };
  return createElement(Component, props, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a paragraph token into a React element containing its inline children.
 *
 * @param token - Paragraph token with inline children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the paragraph.
 */
function renderParagraph(token: ParagraphToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.paragraph;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a fenced code block token into a React element.
 *
 * Passes lang, info, content, and optional pre-highlighted html to the component.
 *
 * @param token - Code block token with language, info string, and content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the code block.
 */
function renderCodeBlock(token: CodeBlockToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.codeBlock;
  const htmlValue = token.meta?.html;
  const props: {
    readonly key: string;
    readonly lang: string;
    readonly info: string;
    readonly content: string;
    readonly html?: string;
    readonly allowDangerousMetaHtml: boolean;
  } =
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
 * Renders a raw HTML block token into a React element.
 *
 * @param token - HTML block token with raw content string.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the HTML block.
 */
function renderHtmlBlock(token: HtmlBlockToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.htmlBlock;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders a horizontal rule (thematic break) into a React element.
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the horizontal rule.
 */
function renderHr(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.hr;
  return createElement(Component, { key });
}

/**
 * Renders a table token into a React element with head and body rows.
 *
 * @param token - Table token with head cells, body rows, and column alignments.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the table.
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
 * Renders a display-math block token based on the configured math mode.
 *
 * Returns null for "none", TeX-delimited string for "tex-delim", or a
 * component element for "span-class".
 *
 * @param token - Math block token with TeX content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode, string, or null depending on math mode.
 */
function renderMathBlock(token: MathBlockToken, resolved: Resolved, key: string): ReactNode {
  if (resolved.math === "none") return null;
  if (resolved.math === "tex-delim") return `$$\n${token.content}$$\n`;
  const Component = resolved.components.mathBlock;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an array of inline tokens into a Fragment of React nodes.
 *
 * @param tokens - Array of inline tokens to render.
 * @param resolved - Resolved rendering configuration.
 * @param keyPrefix - Prefix for React keys to ensure uniqueness.
 * @returns Fragment containing all inline nodes, or null if tokens is empty.
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
 * @param token - Inline token to render.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the inline token.
 * @throws Error via unreachableToken if the token type is unknown.
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
 * Renders a text token into a React element.
 *
 * The token's `content` may contain raw HTML entity references such as
 * `&amp;`, `&#65;`, or `&copy;` — the parser emits numeric entities
 * decoded but leaves named entities as literal text. JSX auto-escapes
 * every string it embeds, so passing `"&amp;"` through unchanged would
 * produce `&amp;amp;` in the rendered HTML. To match the behaviour of
 * `@streamd/html` (which runs `escapeHtml(decodeEntities(content))`),
 * we decode entity references here so JSX's auto-escape plays the role
 * of the HTML renderer's `escapeHtml` pass. See `./escape.ts` for the
 * full rationale and parity contract.
 *
 * @param token - Text token with content string.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the text content.
 */
function renderText(token: TextToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.text;
  return createElement(Component, { key, content: decodeEntities(token.content) });
}

/**
 * Renders a soft line break token into a React element.
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the soft break.
 */
function renderSoftbreak(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.softbreak;
  return createElement(Component, { key });
}

/**
 * Renders a hard line break token into a React element.
 *
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the hard break.
 */
function renderHardbreak(resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.hardbreak;
  return createElement(Component, { key });
}

/**
 * Renders an inline code span token into a React element.
 *
 * @param token - Code span token with content string.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the code span.
 */
function renderCodeSpan(token: CodeSpanToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.codeSpan;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an emphasis (italic) token into a React element.
 *
 * @param token - Em token with inline children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the emphasis wrapper.
 */
function renderEm(token: EmToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.em;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a strong (bold) token into a React element.
 *
 * @param token - Strong token with inline children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the strong wrapper.
 */
function renderStrong(token: StrongToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.strong;
  return createElement(Component, { key }, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders a strikethrough token into a React element.
 *
 * @param token - Strikethrough token with inline children.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the strikethrough wrapper.
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
 * Renders a link token into a React element with href, title, and optional meta.
 *
 * Passes rel, target, and className from token.meta when present.
 *
 * @param token - Link token with href, title, children, and optional meta.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the link.
 */
function renderLink(token: LinkToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.link;
  const props: {
    readonly key: string;
    readonly href: string;
    readonly title: string;
    readonly rel?: string;
    readonly target?: string;
    readonly className?: string;
  } = {
    key,
    href: token.href,
    title: token.title,
    ...(token.meta?.rel ? { rel: token.meta.rel } : {}),
    ...(token.meta?.target ? { target: token.meta.target } : {}),
    ...(token.meta?.className ? { className: token.meta.className } : {}),
  };
  return createElement(Component, props, renderInlines(token.children, resolved, `${key}-i`));
}

/**
 * Renders an image token into a React element with src, alt, and title.
 *
 * @param token - Image token with src URL, alt text, and title.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the image.
 */
function renderImage(token: ImageToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.image;
  return createElement(Component, { key, src: token.src, alt: token.alt, title: token.title });
}

/**
 * Renders an inline HTML token into a React element.
 *
 * @param token - HTML inline token with raw content string.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the inline HTML.
 */
function renderHtmlInline(token: HtmlInlineToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.htmlInline;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an escape token (backslash-escaped character) into a React element.
 *
 * @param token - Escape token with the escaped character as content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode for the escaped character.
 */
function renderEscape(token: EscapeToken, resolved: Resolved, key: string): ReactNode {
  const Component = resolved.components.escape;
  return createElement(Component, { key, content: token.content });
}

/**
 * Renders an inline math token based on the configured math mode.
 *
 * Returns null for "none", TeX-delimited string for "tex-delim", or a
 * component element for "span-class".
 *
 * @param token - Math inline token with TeX content.
 * @param resolved - Resolved rendering configuration.
 * @param key - React key for the rendered element.
 * @returns ReactNode, string, or null depending on math mode.
 */
function renderMathInline(token: MathInlineToken, resolved: Resolved, key: string): ReactNode {
  if (resolved.math === "none") return null;
  if (resolved.math === "tex-delim") return `$${token.content}$`;
  const Component = resolved.components.mathInline;
  return createElement(Component, { key, content: token.content });
}
