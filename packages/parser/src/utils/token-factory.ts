/**
 * Token factory functions — single source of truth for monomorphic construction.
 *
 * ALL fields initialized in fixed order per token type.
 * V8/JSC create one hidden class per factory, ensuring monomorphic IC hits.
 *
 * @module utils/token-factory
 */
import { TokenType } from "../types/token-type";
import type {
  Align,
  BlockquoteToken,
  CodeBlockToken,
  CodeSpanToken,
  EmToken,
  EscapeToken,
  HardbreakToken,
  HeadingToken,
  HrToken,
  HtmlBlockToken,
  HtmlInlineToken,
  ImageToken,
  InlineToken,
  LinkToken,
  ListItemToken,
  ListToken,
  MathBlockToken,
  MathInlineToken,
  ParagraphToken,
  SoftbreakToken,
  SpaceToken,
  StrikethroughToken,
  StrongToken,
  TableToken,
  TextToken,
  Token,
} from "../types/tokens";

/** Create a text content token. */
export function createTextToken(content: string): TextToken {
  return { type: TokenType.Text, content };
}

/** Create a soft line break token (newline not preceded by 2+ spaces). */
export function createSoftbreakToken(): SoftbreakToken {
  return { type: TokenType.Softbreak };
}

/** Create a hard line break token (2+ trailing spaces or backslash before newline). */
export function createHardbreakToken(): HardbreakToken {
  return { type: TokenType.Hardbreak };
}

/** Create a code span token with normalized content. */
export function createCodeSpanToken(content: string): CodeSpanToken {
  return { type: TokenType.CodeSpan, content };
}

/** Create an emphasis (em) token wrapping inline children. */
export function createEmToken(children: Array<InlineToken>): EmToken {
  return { type: TokenType.Em, children };
}

/** Create a strong emphasis token wrapping inline children. */
export function createStrongToken(children: Array<InlineToken>): StrongToken {
  return { type: TokenType.Strong, children };
}

/** Create a strikethrough token wrapping inline children (GFM). */
export function createStrikethroughToken(children: Array<InlineToken>): StrikethroughToken {
  return { type: TokenType.Strikethrough, children };
}

/** Create a link token with href, title, and inline children. */
export function createLinkToken(
  href: string,
  title: string,
  children: Array<InlineToken>,
): LinkToken {
  return { type: TokenType.Link, href, title, children };
}

/** Create an image token with src, alt text, and title. */
export function createImageToken(src: string, alt: string, title: string): ImageToken {
  return { type: TokenType.Image, src, alt, title };
}

/** Create an inline HTML token with raw HTML content. */
export function createHtmlInlineToken(content: string): HtmlInlineToken {
  return { type: TokenType.HtmlInline, content };
}

/** Create a backslash escape token with the escaped character. */
export function createEscapeToken(content: string): EscapeToken {
  return { type: TokenType.Escape, content };
}

/** Create an inline math token with LaTeX content. */
export function createMathInlineToken(content: string): MathInlineToken {
  return { type: TokenType.MathInline, content };
}

/** Create a heading token with level (1–6) and inline children. */
export function createHeadingToken(
  level: 1 | 2 | 3 | 4 | 5 | 6,
  children: Array<InlineToken>,
): HeadingToken {
  return { type: TokenType.Heading, level, children };
}

/** Create a paragraph token wrapping inline children. */
export function createParagraphToken(children: Array<InlineToken>): ParagraphToken {
  return { type: TokenType.Paragraph, children };
}

/** Create a code block token with language, info string, and content. */
export function createCodeBlockToken(lang: string, info: string, content: string): CodeBlockToken {
  return { type: TokenType.CodeBlock, lang, info, content };
}

/** Create an HTML block token with raw HTML content. */
export function createHtmlBlockToken(content: string): HtmlBlockToken {
  return { type: TokenType.HtmlBlock, content };
}

/** Create a thematic break (horizontal rule) token. */
export function createHrToken(): HrToken {
  return { type: TokenType.Hr };
}

/** Create a blank line (space) token. */
export function createSpaceToken(): SpaceToken {
  return { type: TokenType.Space };
}

/** Create a blockquote token wrapping child tokens. */
export function createBlockquoteToken(children: Array<Token>): BlockquoteToken {
  return { type: TokenType.Blockquote, children };
}

/** Create a list token with ordering, start number, tightness, and item children. */
export function createListToken(
  ordered: boolean,
  start: number,
  tight: boolean,
  children: Array<ListItemToken>,
): ListToken {
  return { type: TokenType.List, ordered, start, tight, children };
}

/** Create a list item token with optional checkbox state and child tokens. */
export function createListItemToken(
  checked: boolean | null,
  children: Array<Token>,
): ListItemToken {
  return { type: TokenType.ListItem, checked, children };
}

/** Create a GFM table token with column alignments, header, and data rows. */
export function createTableToken(
  align: Array<Align>,
  head: Array<Array<InlineToken>>,
  rows: Array<Array<Array<InlineToken>>>,
): TableToken {
  return { type: TokenType.Table, align, head, rows };
}

/** Create a block math token with LaTeX content. */
export function createMathBlockToken(content: string): MathBlockToken {
  return { type: TokenType.MathBlock, content };
}
