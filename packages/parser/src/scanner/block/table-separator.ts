/**
 * GFM table separator detection.
 *
 * Matches pipe-delimited separator lines with alignment markers.
 * Zero regex — all matching via charCode comparisons.
 *
 * @module scanner/block/table-separator
 */

import type { Align } from "../../types/tokens";
import { CC_COLON, CC_DASH, CC_PIPE, CC_SPACE, CC_TAB } from "../constants";

/**
 * Try to match a GFM table separator line.
 *
 * Pattern: `|---|:---:|---:|` (pipe-delimited with `-`/`:` alignment markers).
 * Returns alignment array or null.
 */
export function tryTableSeparator(src: string, pos: number, lineEnd: number): Array<Align> | null {
  let i = pos;

  // Skip leading whitespace
  while (i < lineEnd && (src.charCodeAt(i) === CC_SPACE || src.charCodeAt(i) === CC_TAB)) i++;

  // Skip optional leading pipe
  if (i < lineEnd && src.charCodeAt(i) === CC_PIPE) i++;

  const aligns: Array<Align> = [];
  let hasContent = false;

  while (i < lineEnd && aligns.length < 128) {
    // Skip whitespace
    while (i < lineEnd && (src.charCodeAt(i) === CC_SPACE || src.charCodeAt(i) === CC_TAB)) i++;
    if (i >= lineEnd) break;

    // Check for end pipe
    if (src.charCodeAt(i) === CC_PIPE) {
      if (!hasContent) return null;
      i++;
      let j = i;
      while (j < lineEnd && (src.charCodeAt(j) === CC_SPACE || src.charCodeAt(j) === CC_TAB)) j++;
      if (j >= lineEnd) break;
      continue;
    }

    // Parse alignment cell: [:]-+[:]
    let leftColon = false;
    let rightColon = false;

    if (src.charCodeAt(i) === CC_COLON) {
      leftColon = true;
      i++;
    }

    let dashCount = 0;
    while (i < lineEnd && src.charCodeAt(i) === CC_DASH) {
      dashCount++;
      i++;
    }
    if (dashCount === 0) return null;

    if (i < lineEnd && src.charCodeAt(i) === CC_COLON) {
      rightColon = true;
      i++;
    }

    hasContent = true;

    if (leftColon && rightColon) aligns.push("center");
    else if (leftColon) aligns.push("left");
    else if (rightColon) aligns.push("right");
    else aligns.push(null);

    while (i < lineEnd && (src.charCodeAt(i) === CC_SPACE || src.charCodeAt(i) === CC_TAB)) i++;
    if (i < lineEnd && src.charCodeAt(i) === CC_PIPE) i++;
  }

  if (aligns.length === 0) return null;
  return aligns;
}
