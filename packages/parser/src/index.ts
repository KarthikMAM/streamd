/**
 * @streamd/parser — streaming-first markdown parser
 *
 * Core parser, tokenizer, plugin system, and AST builder.
 */

export interface StreamdOptions {
  /** Enable streaming mode */
  streaming?: boolean;
}

/**
 * Parse a markdown string into tokens.
 * This is a placeholder — real implementation coming soon.
 */
export function parse(input: string, _options?: StreamdOptions): string[] {
  if (!input) return [];
  return input.split("\n");
}
