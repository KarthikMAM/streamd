/**
 * Shared test fixture types for the e2e suite. Extracting them keeps
 * the test files' `SAMPLES`/`cases` tables and helper signatures free of
 * inline object types.
 *
 * @module e2e/types
 */

/**
 * Fixture row for the streaming-invariants suite — a named markdown
 * sample fed through the parser character-by-character.
 */
export interface StreamingSample {
  /** Human-readable label shown in the test name. */
  readonly name: string;
  /** Markdown source to feed through the streaming parser. */
  readonly markdown: string;
}

/**
 * One observation of the parser's stable prefix after appending one
 * character of source. `stablePrefix` is a canonicalised JSON string
 * covering `tokens[0..stableCount]`.
 */
export interface FeedStep {
  /** 1-based index of the character that was just appended. */
  readonly step: number;
  /** Number of tokens the parser reports as stable at this step. */
  readonly stableCount: number;
  /** Canonicalised JSON snapshot of the stable-prefix tokens. */
  readonly stablePrefix: string;
}

/**
 * Fixture row for the renderer-equivalence suite — a named markdown
 * sample rendered once through the HTML renderer and once through the
 * React renderer, whose outputs are compared after normalisation.
 */
export interface RenderSample {
  /** Human-readable label shown in the test name. */
  readonly name: string;
  /** Markdown source to render through both renderers. */
  readonly markdown: string;
}

/**
 * Fixture row for the react-vs-html parity suite — a named markdown
 * snippet optionally parsed with GFM extensions enabled.
 */
export interface ParityCase {
  /** Human-readable label shown in the test name. */
  readonly name: string;
  /** Markdown source to render through both renderers. */
  readonly md: string;
  /** When true, parse with GFM features enabled. Defaults to false. */
  readonly gfm?: boolean;
}
