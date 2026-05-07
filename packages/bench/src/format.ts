/**
 * Shared output helpers for bench scripts.
 *
 * These run as one-shot Node scripts, so they may legitimately use
 * `console.log` (allowed by the steering exception for `scripts/`).
 *
 * @module bench/format
 */

/**
 * Pad a string to `width` with trailing spaces (right-pad).
 *
 * @param text - The string to pad.
 * @param width - Target width. If `text` is already at least this wide,
 *   it is returned unchanged.
 * @returns The padded string.
 */
export function padEnd(text: string, width: number): string {
  if (text.length >= width) return text;
  return text + " ".repeat(width - text.length);
}

/**
 * Pad a string to `width` with leading spaces (left-pad).
 *
 * @param text - The string to pad.
 * @param width - Target width. If `text` is already at least this wide,
 *   it is returned unchanged.
 * @returns The padded string.
 */
export function padStart(text: string, width: number): string {
  if (text.length >= width) return text;
  return " ".repeat(width - text.length) + text;
}

/**
 * Format a duration in milliseconds with unit-aware precision.
 *
 * @param ms - Duration in milliseconds. Sub-microsecond values are
 *   rendered as nanoseconds; sub-millisecond as microseconds.
 * @returns Human-readable duration string with unit suffix.
 */
export function formatMs(ms: number): string {
  if (ms < 0.001) return `${(ms * 1_000_000).toFixed(0)} ns`;
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
  return `${ms.toFixed(3)} ms`;
}

/**
 * Format a nanosecond value with unit-aware precision.
 *
 * @param ns - Duration in nanoseconds. Values above 1 µs are rendered
 *   as microseconds; above 1 ms as milliseconds.
 * @returns Human-readable duration string with unit suffix.
 */
export function formatNs(ns: number): string {
  if (ns < 1000) return `${ns.toFixed(0)} ns`;
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(1)} µs`;
  return `${(ns / 1_000_000).toFixed(2)} ms`;
}

/**
 * Compute per-column widths for a matrix of strings.
 *
 * @param rows - Row-major matrix. Each inner array is one table row.
 * @returns Array of column widths (max cell length per column).
 */
function columnWidths(rows: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<number> {
  if (rows.length === 0) return [];

  const firstRow = rows[0];
  if (!firstRow) return [];

  const widths: Array<number> = new Array<number>(firstRow.length).fill(0);
  for (const row of rows) {
    for (let c = 0; c < row.length && c < widths.length; c++) {
      const cell = row[c];
      const currentWidth = widths[c] ?? 0;
      if (cell !== undefined && cell.length > currentWidth) {
        widths[c] = cell.length;
      }
    }
  }
  return widths;
}

/**
 * Print a markdown-style table to stdout.
 *
 * @param rows - Row-major matrix of strings. The first row is treated as a
 *   header with a divider rendered beneath.
 */
export function printTable(rows: ReadonlyArray<ReadonlyArray<string>>): void {
  if (rows.length === 0) return;

  const widths = columnWidths(rows);
  for (let r = 0; r < rows.length; r++) {
    console.log(renderRow(rows[r] ?? [], widths));
    if (r === 0) console.log(renderDivider(widths));
  }
}

/**
 * Render a single row, left-aligning the first cell and right-aligning the rest.
 *
 * @param row - Cell values for this row.
 * @param widths - Per-column widths from `columnWidths`.
 * @returns Pipe-delimited row string.
 */
function renderRow(row: ReadonlyArray<string>, widths: ReadonlyArray<number>): string {
  const cells: Array<string> = [];
  for (let c = 0; c < row.length; c++) {
    const width = widths[c] ?? 0;
    const cell = row[c] ?? "";
    cells.push(c === 0 ? padEnd(cell, width) : padStart(cell, width));
  }
  return `| ${cells.join(" | ")} |`;
}

/**
 * Render the `|---|---|` divider under the header row.
 *
 * @param widths - Per-column widths from `columnWidths`.
 * @returns Pipe-delimited divider string.
 */
function renderDivider(widths: ReadonlyArray<number>): string {
  return `|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`;
}
