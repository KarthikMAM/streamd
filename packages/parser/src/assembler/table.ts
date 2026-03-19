/**
 * GFM table assembly for the flat architecture.
 *
 * Splits pipe-delimited rows, parses cell content as inlines.
 *
 * @module assembler/table
 */

import type { Block } from "../scanner/block/types";
import { findLineEndFast, isSpaceOrTab, nextLine } from "../scanner/block/utils";
import { CC_BACKSLASH, CC_PIPE } from "../scanner/constants";
import { parseInlines } from "../scanner/inline/scan";
import type { LinkReference } from "../types/internal";
import type { InlineToken, Token } from "../types/tokens";
import { createTableToken } from "../utils/token-factory";
import type { AssembleOpts } from "./assemble";

/** Assemble a GFM table from a flat block. */
export function assembleTable(
  src: string,
  block: Block,
  refMap: Map<string, LinkReference>,
  opts: AssembleOpts,
): Token {
  const align = block.align;
  const numCols = Math.min(align.length, 128);

  const rows: Array<{ start: number; end: number }> = [];
  let pos = block.contentStart;
  while (pos <= block.contentEnd && pos < src.length) {
    const le = findLineEndFast(src, pos);
    const lineEnd = le > block.contentEnd ? block.contentEnd : le;
    rows.push({ start: pos, end: lineEnd });
    pos = nextLine(src, le);
    if (le >= block.contentEnd) break;
  }

  if (rows.length === 0) return createTableToken(align, [], []);

  // Header = first row
  const headCells = splitPipeCells(src, rows[0]!.start, rows[0]!.end);
  const head: Array<Array<InlineToken>> = [];
  for (let i = 0; i < numCols; i++) {
    if (i < headCells.length) {
      const c = headCells[i]!;
      head.push(
        parseInlines(src, c.start, c.end, refMap, opts.math, opts.autolinks, opts.strikethrough),
      );
    } else {
      head.push([]);
    }
  }

  // Data rows (skip separator = row index 1)
  const dataRows: Array<Array<Array<InlineToken>>> = [];
  for (let ri = 2; ri < rows.length; ri++) {
    const cells = splitPipeCells(src, rows[ri]!.start, rows[ri]!.end);
    const row: Array<Array<InlineToken>> = [];
    for (let i = 0; i < numCols; i++) {
      if (i < cells.length) {
        const c = cells[i]!;
        row.push(
          parseInlines(src, c.start, c.end, refMap, opts.math, opts.autolinks, opts.strikethrough),
        );
      } else {
        row.push([]);
      }
    }
    dataRows.push(row);
  }

  return createTableToken(align, head, dataRows);
}

/** Split a pipe-delimited row into cell ranges. */
function splitPipeCells(
  src: string,
  start: number,
  end: number,
): Array<{ start: number; end: number }> {
  const cells: Array<{ start: number; end: number }> = [];
  let pos = start;

  while (pos < end && isSpaceOrTab(src.charCodeAt(pos))) pos++;
  if (pos < end && src.charCodeAt(pos) === CC_PIPE) pos++;

  let cellStart = pos;
  while (pos < end && cells.length < 128) {
    const code = src.charCodeAt(pos);
    if (code === CC_BACKSLASH && pos + 1 < end && src.charCodeAt(pos + 1) === CC_PIPE) {
      pos += 2;
      continue;
    }
    if (code === CC_PIPE) {
      cells.push(trimCellRange(src, cellStart, pos));
      cellStart = pos + 1;
    }
    pos++;
  }

  if (cellStart < end) {
    const trimmed = trimCellRange(src, cellStart, end);
    if (trimmed.start < trimmed.end) cells.push(trimmed);
  }

  return cells;
}

/** Trim whitespace from a cell range. */
function trimCellRange(src: string, start: number, end: number): { start: number; end: number } {
  while (start < end && isSpaceOrTab(src.charCodeAt(start))) start++;
  while (end > start && isSpaceOrTab(src.charCodeAt(end - 1))) end--;
  return { start, end };
}
