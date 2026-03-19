/**
 * Token type constants — dense integers for hot-path dispatch.
 *
 * Used as the discriminant field in all public token interfaces.
 * Dense numbering (0–22) enables V8 jump table optimization in switch statements.
 *
 * Values 0–9 are block tokens, 10–22 are inline tokens.
 *
 * @module types/token-type
 */

/** Dense integer token type constants. */
export const TokenType = {
  Blockquote: 0,
  List: 1,
  ListItem: 2,
  Heading: 3,
  Paragraph: 4,
  CodeBlock: 5,
  HtmlBlock: 6,
  Hr: 7,
  Space: 8,
  Table: 9,
  Text: 10,
  Softbreak: 11,
  Hardbreak: 12,
  CodeSpan: 13,
  Em: 14,
  Strong: 15,
  Strikethrough: 16,
  Link: 17,
  Image: 18,
  HtmlInline: 19,
  Escape: 20,
  MathInline: 21,
  MathBlock: 22,
} as const;

/** Union of all valid token type integer values. */
export type TokenTypeValue = (typeof TokenType)[keyof typeof TokenType];
