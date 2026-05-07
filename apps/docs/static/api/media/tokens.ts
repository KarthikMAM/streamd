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

/**
 * Optional plugin-driven metadata attached to any block or inline token.
 *
 * Parsers never set these fields; they are populated by `@streamd/plugins`
 * transforms (headingAnchors, linkAttributes, highlightCode, etc.). Renderers
 * read them and emit the corresponding attributes. Every field is optional
 * and additive — tokens without any plugin metadata render exactly as before.
 */
export interface TokenMeta {
  /** `id` attribute. Populated by headingAnchors. */
  readonly id?: string;
  /** Extra `class` tokens (space-joined with any prefixed class). */
  readonly className?: string;
  /** `rel` attribute (links only). Populated by linkAttributes. */
  readonly rel?: string;
  /** `target` attribute (links only). Populated by linkAttributes. */
  readonly target?: string;
  /** Pre-rendered HTML string — renderers emit this verbatim instead of the
   *  default element. Populated by highlightCode for CodeBlock. */
  readonly html?: string;
  /** Arbitrary key/value attributes injected directly on the element. */
  readonly attrs?: Readonly<Record<string, string>>;
}
export interface BlockquoteToken {
  type: typeof TokenType.Blockquote;
  children: Array<Token>;
  meta?: TokenMeta;
}

export interface ListToken {
  type: typeof TokenType.List;
  ordered: boolean;
  start: number;
  tight: boolean;
  children: Array<ListItemToken>;
  meta?: TokenMeta;
}

export interface ListItemToken {
  type: typeof TokenType.ListItem;
  checked: boolean | null;
  children: Array<Token>;
  meta?: TokenMeta;
}

export interface HeadingToken {
  type: typeof TokenType.Heading;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

export interface ParagraphToken {
  type: typeof TokenType.Paragraph;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

export interface CodeBlockToken {
  type: typeof TokenType.CodeBlock;
  lang: string;
  info: string;
  content: string;
  meta?: TokenMeta;
}

export interface HtmlBlockToken {
  type: typeof TokenType.HtmlBlock;
  content: string;
  meta?: TokenMeta;
}

export interface HrToken {
  type: typeof TokenType.Hr;
  meta?: TokenMeta;
}

export interface SpaceToken {
  type: typeof TokenType.Space;
  meta?: TokenMeta;
}

export interface TableToken {
  type: typeof TokenType.Table;
  align: Array<Align>;
  head: Array<Array<InlineToken>>;
  rows: Array<Array<Array<InlineToken>>>;
  meta?: TokenMeta;
}
export interface TextToken {
  type: typeof TokenType.Text;
  content: string;
  meta?: TokenMeta;
}

export interface SoftbreakToken {
  type: typeof TokenType.Softbreak;
  meta?: TokenMeta;
}

export interface HardbreakToken {
  type: typeof TokenType.Hardbreak;
  meta?: TokenMeta;
}

export interface CodeSpanToken {
  type: typeof TokenType.CodeSpan;
  content: string;
  meta?: TokenMeta;
}

export interface EmToken {
  type: typeof TokenType.Em;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

export interface StrongToken {
  type: typeof TokenType.Strong;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

export interface StrikethroughToken {
  type: typeof TokenType.Strikethrough;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

export interface LinkToken {
  type: typeof TokenType.Link;
  href: string;
  title: string;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

export interface ImageToken {
  type: typeof TokenType.Image;
  src: string;
  alt: string;
  title: string;
  meta?: TokenMeta;
}

export interface HtmlInlineToken {
  type: typeof TokenType.HtmlInline;
  content: string;
  meta?: TokenMeta;
}

export interface EscapeToken {
  type: typeof TokenType.Escape;
  content: string;
  meta?: TokenMeta;
}

export interface MathInlineToken {
  type: typeof TokenType.MathInline;
  content: string;
  meta?: TokenMeta;
}

export interface MathBlockToken {
  type: typeof TokenType.MathBlock;
  content: string;
  meta?: TokenMeta;
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
