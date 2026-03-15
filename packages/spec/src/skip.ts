/**
 * Known spec divergences — skipped tests.
 * Add entries where @streamd/parser intentionally deviates.
 * Remove entries as compliance improves.
 */
export const SKIP: Record<string, Set<string>> = {
  commonmark: new Set([]),
  gfm: new Set([]),
};
