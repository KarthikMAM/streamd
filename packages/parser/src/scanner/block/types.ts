/**
 * Lightweight flat block record for the scan-to-completion architecture.
 *
 * Each block stores its type, source range, content range, and minimal
 * metadata. No children arrays, no tree structure — containers are
 * recursively parsed during assembly.
 *
 * @module scanner/block/types
 */
import type { Align } from "../../types/tokens";

/** Dense integer block kind constants. */
export const BlockKind = {
  Paragraph: 0,
  AtxHeading: 1,
  SetextHeading: 2,
  FencedCode: 3,
  IndentedCode: 4,
  HtmlBlock: 5,
  ThematicBreak: 6,
  Blockquote: 7,
  List: 8,
  Table: 9,
  Space: 10,
  MathBlock: 11,
} as const;

/** Union of all valid flat block kind values. */
export type BlockKindValue = (typeof BlockKind)[keyof typeof BlockKind];

/**
 * Block — monomorphic record for a scanned block.
 *
 * ALL fields always present. Unused fields set to zero-values.
 * Created via {@link createBlock} factory only.
 */
export interface Block {
  kind: BlockKindValue;
  /** Start offset in source (inclusive) */
  start: number;
  /** End offset in source (exclusive — past last content char) */
  end: number;
  /** Content start (past markers/fences) */
  contentStart: number;
  /** Content end */
  contentEnd: number;
  /** Heading level (1-6) or 0 */
  level: number;
  /** Fence char code or 0 */
  fenceChar: number;
  /** Fence length or 0 */
  fenceLength: number;
  /** Fence indent or 0 */
  fenceIndent: number;
  /** Code block language */
  lang: string;
  /** Code block info string */
  info: string;
  /** HTML block type (1-7) or 0 */
  htmlBlockType: number;
  /** Table alignment array */
  align: Array<Align>;
  /** List: ordered flag */
  ordered: boolean;
  /** List: start number */
  listStart: number;
  /** Whether task list items are enabled for this list */
  taskListItems: boolean;
}

/**
 * Create a Block with all fields initialized in fixed order.
 * V8 creates one hidden class for all calls.
 */
export function createBlock(kind: BlockKindValue, start: number): Block {
  return {
    kind,
    start,
    end: 0,
    contentStart: 0,
    contentEnd: 0,
    level: 0,
    fenceChar: 0,
    fenceLength: 0,
    fenceIndent: 0,
    lang: "",
    info: "",
    htmlBlockType: 0,
    align: [],
    ordered: false,
    listStart: 0,
    taskListItems: false,
  };
}
