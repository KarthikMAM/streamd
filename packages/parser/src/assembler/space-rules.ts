/**
 * Space emission rules between adjacent block tokens.
 *
 * Determines whether a SpaceToken should be inserted between two
 * consecutive blocks in the assembled token list. Removes renderer
 * reliance on CSS margin-collapse for vertical whitespace.
 *
 * @module assembler/space-rules
 */
import type { Token } from "../types/tokens";

/**
 * Determine whether a SpaceToken should be emitted between two adjacent blocks.
 *
 * Returns false (suppress space) for specific adjacency patterns where
 * vertical whitespace is undesirable:
 * - After a heading (unless followed by hr)
 * - After a table (always suppressed)
 * - Paragraph followed by list
 * - Paragraph followed by table
 * - List followed by list
 *
 * @param prev - The preceding token (null at document start)
 * @param next - The following token (null at document end)
 * @returns true if a SpaceToken should be emitted between prev and next
 */
export function shouldEmitSpace(prev: Token | null, next: Token | null): boolean {
  if (!(prev && next)) return false;

  const p = prev.type;
  const n = next.type;

  if (p === "heading" && n !== "hr") return false;
  if (p === "table") return false;
  if (p === "paragraph" && n === "list") return false;
  if (p === "paragraph" && n === "table") return false;
  if (p === "list" && n === "list") return false;

  return true;
}
