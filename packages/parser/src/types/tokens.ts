/**
 * Public token interfaces — the output of `parse()`.
 *
 * 23 concrete interfaces forming a discriminated union on the `type` field.
 * Every token has a `type: TokenTypeValue` discriminant.
 * All fields are always present (monomorphic shapes).
 *
 * @module types/tokens
 */
import type { TokenType } from "./token-type";

export type Align = "left" | "center" | "right" | null;
export interface BlockquoteToken {
  type: typeof TokenType.Blockquote;
  children: Array<Token>;
}

export interface ListToken {
  type: typeof TokenType.List;
  ordered: boolean;
  start: number;
  tight: boolean;
  children: Array<ListItemToken>;
}

export interface ListItemToken {
  type: typeof TokenType.ListItem;
  checked: boolean | null;
  children: Array<Token>;
}

export interface HeadingToken {
  type: typeof TokenType.Heading;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: Array<InlineToken>;
}

export interface ParagraphToken {
  type: typeof TokenType.Paragraph;
  children: Array<InlineToken>;
}

export interface CodeBlockToken {
  type: typeof TokenType.CodeBlock;
  lang: string;
  info: string;
  content: string;
}

export interface HtmlBlockToken {
  type: typeof TokenType.HtmlBlock;
  content: string;
}

export interface HrToken {
  type: typeof TokenType.Hr;
}

export interface SpaceToken {
  type: typeof TokenType.Space;
}

export interface TableToken {
  type: typeof TokenType.Table;
  align: Array<Align>;
  head: Array<Array<InlineToken>>;
  rows: Array<Array<Array<InlineToken>>>;
}
export interface TextToken {
  type: typeof TokenType.Text;
  content: string;
}

export interface SoftbreakToken {
  type: typeof TokenType.Softbreak;
}

export interface HardbreakToken {
  type: typeof TokenType.Hardbreak;
}

export interface CodeSpanToken {
  type: typeof TokenType.CodeSpan;
  content: string;
}

export interface EmToken {
  type: typeof TokenType.Em;
  children: Array<InlineToken>;
}

export interface StrongToken {
  type: typeof TokenType.Strong;
  children: Array<InlineToken>;
}

export interface StrikethroughToken {
  type: typeof TokenType.Strikethrough;
  children: Array<InlineToken>;
}

export interface LinkToken {
  type: typeof TokenType.Link;
  href: string;
  title: string;
  children: Array<InlineToken>;
}

export interface ImageToken {
  type: typeof TokenType.Image;
  src: string;
  alt: string;
  title: string;
}

export interface HtmlInlineToken {
  type: typeof TokenType.HtmlInline;
  content: string;
}

export interface EscapeToken {
  type: typeof TokenType.Escape;
  content: string;
}

export interface MathInlineToken {
  type: typeof TokenType.MathInline;
  content: string;
}

export interface MathBlockToken {
  type: typeof TokenType.MathBlock;
  content: string;
}
export type BlockToken =
  | BlockquoteToken
  | ListToken
  | ListItemToken
  | HeadingToken
  | ParagraphToken
  | CodeBlockToken
  | HtmlBlockToken
  | HrToken
  | SpaceToken
  | TableToken
  | MathBlockToken;

export type InlineToken =
  | TextToken
  | SoftbreakToken
  | HardbreakToken
  | CodeSpanToken
  | EmToken
  | StrongToken
  | StrikethroughToken
  | LinkToken
  | ImageToken
  | HtmlInlineToken
  | EscapeToken
  | MathInlineToken;

export type Token = BlockToken | InlineToken;
export type TokensList = Array<Token>;
