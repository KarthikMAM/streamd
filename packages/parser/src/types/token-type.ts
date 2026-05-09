/**
 * Token type constants — string literals for discriminated union dispatch.
 *
 * Used as the discriminant field in all public token interfaces.
 * V8 interns short literal strings and compares by pointer equality;
 * hot-path cost is within noise of integer comparison.
 *
 * Final set: 20 tokens (HtmlBlock, HtmlInline, Softbreak removed).
 *
 * @module types/token-type
 */

/** String-literal token type constants. */
export const TokenType = {
  Blockquote: "blockquote",
  List: "list",
  ListItem: "list_item",
  Heading: "heading",
  Paragraph: "paragraph",
  CodeBlock: "code_block",
  Hr: "hr",
  Space: "space",
  Table: "table",
  Text: "text",
  Hardbreak: "hardbreak",
  CodeSpan: "code_span",
  Em: "em",
  Strong: "strong",
  Strikethrough: "strikethrough",
  Link: "link",
  Image: "image",
  Escape: "escape",
  MathInline: "math_inline",
  MathBlock: "math_block",
} as const;

/** Union of all valid token type string values. */
export type TokenTypeValue = (typeof TokenType)[keyof typeof TokenType];
