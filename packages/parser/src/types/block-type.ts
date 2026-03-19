/**
 * Legacy block type constants — public API export for backward compatibility.
 *
 * These are NOT used internally by the parser. The internal block scanner
 * uses `BlockKind` from `scanner/block/types.ts` instead.
 *
 * @module types/block-type
 * @deprecated Use BlockKind from scanner/block/types for internal use.
 */

/** Dense integer block type constants (0–13). */
export const BlockType = {
  Document: 0,
  Blockquote: 1,
  List: 2,
  ListItem: 3,
  FencedCode: 4,
  IndentedCode: 5,
  HtmlBlock: 6,
  Paragraph: 7,
  AtxHeading: 8,
  SetextHeading: 9,
  ThematicBreak: 10,
  Table: 11,
  BlankLine: 12,
  LinkRefDef: 13,
} as const;

/** Union of all valid block type integer values. */
export type BlockTypeValue = (typeof BlockType)[keyof typeof BlockType];
