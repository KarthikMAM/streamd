#!/usr/bin/env node
// prepend-module-header.mjs <file> <header-body>
//
// Safely prepends a /** ... */ module-level JSDoc block to a source file
// when it does not already start with one. No-op if a header exists.
//
// Header body is the prose inside the block — this script adds the /** */
// wrapper and splits multiline bodies into " * " lines.

import { readFileSync, writeFileSync } from "node:fs";

const [, , path, ...bodyParts] = process.argv;
if (!path || bodyParts.length === 0) {
  process.stderr.write("usage: prepend-module-header.mjs <file> <body...>\n");
  process.exit(2);
}
const body = bodyParts.join(" ");
const text = readFileSync(path, "utf8");
const leading = text.replace(/^\uFEFF/, "").replace(/^\s+/, "");
if (leading.startsWith("/**")) {
  process.stdout.write(`${path}: already has JSDoc header\n`);
  process.exit(0);
}
const lines = body.split("\n");
const block =
  lines.length === 1 && body.length < 85
    ? `/** ${body} */\n`
    : `/**\n${lines.map((l) => ` * ${l}`.trimEnd()).join("\n")}\n */\n`;
writeFileSync(path, block + text, "utf8");
process.stdout.write(`${path}: added module header\n`);
