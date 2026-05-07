#!/usr/bin/env node
/**
 * Node CLI demo — parse a markdown file (or stdin) and print HTML.
 *
 * Usage:
 *   node cli.mjs                     # reads ../shared/sample.md
 *   node cli.mjs path/to/file.md     # reads the given file
 *   cat file.md | node cli.mjs -     # reads stdin
 *
 * Exits with code 1 on input-read failures or parser errors and writes
 * a short diagnostic to stderr — never silently produces empty output.
 *
 * @module apps/html-demo/cli
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";

/** @type {string} Directory of this script, used as base for resolving the default sample path. */
const here = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the source markdown based on argv, returning its full text.
 *
 * Handles three forms:
 *   - no argument  → default sample under apps/shared/sample.md
 *   - "-"          → read stdin
 *   - otherwise    → path to a markdown file
 *
 * @returns {Promise<string>} The markdown source text.
 */
async function readSource() {
  const arg = process.argv[2];
  if (!arg) {
    return readFile(resolve(here, "../shared/sample.md"), "utf8");
  }
  if (arg === "-") {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8");
  }
  return readFile(arg, "utf8");
}

/** @type {string} Markdown source text resolved from argv, stdin, or the default sample. */
let md;
try {
  md = await readSource();
} catch (error) {
  const isNotFound = error?.code === "ENOENT";

  if (isNotFound) {
    console.error(`apps/html-demo/cli.mjs: file not found (${error.path ?? "?"})`);
  } else {
    console.error("apps/html-demo/cli.mjs: failed to read source", error);
  }
  process.exit(1);
}

/** @type {Array<object>} Parsed token tree from the markdown source, used for HTML rendering. */
let tokens;
try {
  ({ tokens } = parse(md, null, { gfm: true }));
} catch (error) {
  console.error("apps/html-demo/cli.mjs: parse failed", error);
  process.exit(1);
}

process.stdout.write(renderHtml(tokens, { classPrefix: "streamd", wrapRoot: true }));
