/**
 * @streamd/parser — streaming-first markdown parser.
 *
 * Public API: `parse(src, state?, options?)` → `{ tokens, stableCount, state }`
 *
 * @module index
 */
export { createParser, parse } from "./parser";
export type { BlockTypeValue } from "./types/block-type";
export { BlockType } from "./types/block-type";
export type { ParseOptions, ParseResult, ParserState } from "./types/options";
export type { TokenTypeValue } from "./types/token-type";
export { TokenType } from "./types/token-type";
export type {
  Align,
  BlockquoteToken,
  BlockToken,
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
  TokensList,
} from "./types/tokens";
