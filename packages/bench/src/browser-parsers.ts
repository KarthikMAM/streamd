/**
 * Browser-compatible parser bundle.
 *
 * Exports all parsers as a single module for the benchmark HTML page.
 * Bun bundles this into a single ESM file with all deps inlined.
 *
 * @module bench/browser-parsers
 */

export { Parser as CommonmarkParser } from "commonmark";
export { default as MarkdownIt } from "markdown-it";
export { marked } from "marked";
export { parse as streamdParse } from "../../parser/src/index";
