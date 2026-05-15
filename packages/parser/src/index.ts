/**
 * @streamd/parser — streaming-first markdown parser.
 *
 * Public API: `parse(src, state?, options?)` → `{ tokens, stableCount, state }`
 *
 * @module index
 */

/** Core parse functions — stateless one-shot and stateful streaming entry points. */
export { createParser, parse } from "./parser";
/** Token schema version type for ABI compatibility checks. */
export type { TokenSchemaVersion } from "./types/abi";
/** Current token schema version constant. */
export { TOKEN_SCHEMA_VERSION } from "./types/abi";
/** Block type value type (numeric literal union). */
export type { BlockTypeValue } from "./types/block-type";
/** Block type enum-like constant object. */
export { BlockType } from "./types/block-type";
/** Parse options, result shape, and opaque streaming state types. */
export type { ParseOptions, ParseResult, ParserState } from "./types/options";
/** Token type value type (string literal union). */
export type { TokenTypeValue } from "./types/token-type";
/** Token type enum-like constant object. */
export { TokenType } from "./types/token-type";
/** All token interfaces — discriminated union on `type` field. */
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
  HighlightData,
  HrToken,
  ImageToken,
  InlineToken,
  LinkToken,
  ListItemToken,
  ListToken,
  MathBlockToken,
  MathInlineToken,
  ParagraphToken,
  SpaceToken,
  StrikethroughToken,
  StrongToken,
  TableToken,
  TextToken,
  ThemedSegment,
  Token,
  TokenMeta,
  TokensList,
} from "./types/tokens";
