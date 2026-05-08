/**
 * Public token interfaces — the output of `parse()`.
 *
 * 20 concrete interfaces forming a discriminated union on the `type` field.
 * Every token has a `type: TokenTypeValue` discriminant (string literal).
 * All fields are always present (monomorphic shapes).
 *
 * @module types/tokens
 */
import type { TokenType } from "./token-type";

/**
 * GFM table column alignment. `null` indicates no alignment specified in the
 * separator row and the renderer should fall back to its default.
 */
export type Align = "left" | "center" | "right" | null;

/**
 * A single themed segment within a highlighted code line.
 * Produced by plugin-shiki and consumed by renderer components.
 */
export interface ThemedSegment {
  readonly text: string;
  readonly color?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
}

/**
 * Structured syntax-highlight data attached to CodeBlock tokens.
 * Populated by plugin-shiki; renderers emit styled spans from this.
 */
export interface HighlightData {
  /** Array of lines, each an array of themed segments. */
  readonly lines: ReadonlyArray<ReadonlyArray<ThemedSegment>>;
  /** Detected language (may differ from token.lang on fallback). */
  readonly lang: string;
  /** Theme key (light / dark / custom). */
  readonly theme: string;
}

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
  /** Arbitrary key/value attributes injected directly on the element. */
  readonly attrs?: Readonly<Record<string, string>>;
  /** Structured syntax-highlight tokens. plugin-shiki populates. */
  readonly highlight?: HighlightData;
  /** Parsed frontmatter attached to the first paragraph, if any. */
  readonly frontmatter?: Readonly<Record<string, unknown>>;
}

/**
 * Container block token representing a `> ...` blockquote. Children are
 * recursively parsed block tokens, matching CommonMark §5.1.
 */
export interface BlockquoteToken {
  type: typeof TokenType.Blockquote;
  children: Array<Token>;
  meta?: TokenMeta;
}

/**
 * Ordered or unordered list token. `start` is the first item number for
 * ordered lists; `tight` indicates whether the list has blank lines between
 * items (affecting paragraph wrapping in renderers). CommonMark §5.2.
 */
export interface ListToken {
  type: typeof TokenType.List;
  ordered: boolean;
  start: number;
  tight: boolean;
  children: Array<ListItemToken>;
  meta?: TokenMeta;
}

/**
 * Single list item. `checked` is `null` for a plain item or `true`/`false`
 * for a GFM task-list checkbox. Children are block tokens per CommonMark §5.2.
 */
export interface ListItemToken {
  type: typeof TokenType.ListItem;
  checked: boolean | null;
  children: Array<Token>;
  meta?: TokenMeta;
}

/**
 * ATX (`#`) or setext (`===`/`---`) heading. `level` is 1–6; setext headings
 * are always level 1 or 2. Children are inline tokens per CommonMark §4.2.
 */
export interface HeadingToken {
  type: typeof TokenType.Heading;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

/**
 * Paragraph block — any sequence of non-block lines. Children are inline
 * tokens per CommonMark §4.8.
 */
export interface ParagraphToken {
  type: typeof TokenType.Paragraph;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

/**
 * Fenced or indented code block. `lang` is the first whitespace-delimited
 * word of the info string. `content` is the raw code with no inline parsing.
 * CommonMark §4.4–4.5.
 */
export interface CodeBlockToken {
  type: typeof TokenType.CodeBlock;
  lang: string;
  content: string;
  meta?: TokenMeta;
}

/**
 * Thematic break (`---`, `***`, `___`) per CommonMark §4.1. No children.
 */
export interface HrToken {
  type: typeof TokenType.Hr;
  meta?: TokenMeta;
}

/**
 * Blank-line separator token emitted between adjacent blocks when
 * `shouldEmitSpace` returns true. Controls vertical whitespace.
 */
export interface SpaceToken {
  type: typeof TokenType.Space;
  meta?: TokenMeta;
}

/**
 * GFM table. `align` length matches the number of columns. `head` is a
 * single row of cells; each cell is a list of inline tokens. `rows` is an
 * array of rows, each row a list of cells, each cell a list of inline
 * tokens. GFM §4.10.
 */
export interface TableToken {
  type: typeof TokenType.Table;
  align: Array<Align>;
  head: Array<Array<InlineToken>>;
  rows: Array<Array<Array<InlineToken>>>;
  meta?: TokenMeta;
}

/**
 * Literal text run. `content` contains the raw characters with entities
 * decoded. The most common inline token in typical markdown output.
 */
export interface TextToken {
  type: typeof TokenType.Text;
  content: string;
  meta?: TokenMeta;
}

/**
 * Explicit line break — two-space-then-newline or backslash-then-newline.
 * Renderers emit `<br>` or equivalent. CommonMark §6.7.
 */
export interface HardbreakToken {
  type: typeof TokenType.Hardbreak;
  meta?: TokenMeta;
}

/**
 * Inline code span (backtick-delimited). `content` is the literal code with
 * no inline parsing per CommonMark §6.1.
 */
export interface CodeSpanToken {
  type: typeof TokenType.CodeSpan;
  content: string;
  meta?: TokenMeta;
}

/**
 * Emphasised text (`*foo*` / `_foo_`). Children are inline tokens per
 * CommonMark §6.2.
 */
export interface EmToken {
  type: typeof TokenType.Em;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

/**
 * Strongly emphasised text (`**foo**` / `__foo__`). Children are inline
 * tokens per CommonMark §6.2.
 */
export interface StrongToken {
  type: typeof TokenType.Strong;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

/**
 * Strikethrough text (`~~foo~~`). GFM extension §6.5. Children are inline
 * tokens.
 */
export interface StrikethroughToken {
  type: typeof TokenType.Strikethrough;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

/**
 * Inline link. `href` is the resolved URL; `title` is the optional title
 * attribute (empty string when absent). Children are inline tokens forming
 * the link text per CommonMark §6.3.
 */
export interface LinkToken {
  type: typeof TokenType.Link;
  href: string;
  title: string;
  children: Array<InlineToken>;
  meta?: TokenMeta;
}

/**
 * Inline image. `src` is the image URL; `alt` is the flattened alt text
 * (rendered from the original inline children per CommonMark §6.4);
 * `title` is the optional title attribute (empty string when absent).
 */
export interface ImageToken {
  type: typeof TokenType.Image;
  src: string;
  alt: string;
  title: string;
  meta?: TokenMeta;
}

/**
 * Backslash escape of an ASCII punctuation character. `content` is the
 * escaped character alone (without the preceding backslash). CommonMark §2.4.
 */
export interface EscapeToken {
  type: typeof TokenType.Escape;
  content: string;
  meta?: TokenMeta;
}

/**
 * Inline math span (`$...$`). Enabled when `options.math` is set; `content`
 * is the TeX source with the delimiters removed.
 */
export interface MathInlineToken {
  type: typeof TokenType.MathInline;
  content: string;
  meta?: TokenMeta;
}

/**
 * Display math block (`$$...$$`). Enabled when `options.math` is set;
 * `content` is the TeX source with the delimiters removed.
 */
export interface MathBlockToken {
  type: typeof TokenType.MathBlock;
  content: string;
  meta?: TokenMeta;
}

/**
 * Discriminated union of every block-level token. The `type` field
 * distinguishes members.
 */
export type BlockToken =
  | BlockquoteToken
  | ListToken
  | ListItemToken
  | HeadingToken
  | ParagraphToken
  | CodeBlockToken
  | HrToken
  | SpaceToken
  | TableToken
  | MathBlockToken;

/**
 * Discriminated union of every inline-level token. The `type` field
 * distinguishes members.
 */
export type InlineToken =
  | TextToken
  | HardbreakToken
  | CodeSpanToken
  | EmToken
  | StrongToken
  | StrikethroughToken
  | LinkToken
  | ImageToken
  | EscapeToken
  | MathInlineToken;

/**
 * Any token emitted by the parser — the union of all block and inline
 * tokens. Renderers dispatch on `token.type`.
 */
export type Token = BlockToken | InlineToken;

/**
 * Top-level return type of `parse()` — the flat list of block tokens in
 * document order. Inline content is nested inside each block token.
 */
export type TokensList = Array<Token>;
