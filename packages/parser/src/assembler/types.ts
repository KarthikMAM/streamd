/**
 * Shared types for the assembler module — kept in their own file so
 * helper modules (`container.ts`, `table.ts`) can import them without
 * creating a cycle against `assemble.ts`.
 *
 * @module assembler/types
 */

/** Options threaded through assembly for inline parsing and GFM features. */
export interface AssembleOpts {
  /** Whether inline math (`$...$`) and block math (`$$...$$`) are enabled. */
  math: boolean;
  /** Whether GFM strikethrough (`~~text~~`) is enabled. */
  strikethrough: boolean;
  /** Whether GFM extended autolinks (bare URLs) are enabled. */
  autolinks: boolean;
  /** Whether GFM table parsing is enabled. */
  tables: boolean;
  /** Whether GFM task list items (`- [ ]` / `- [x]`) are enabled. */
  taskListItems: boolean;
}
