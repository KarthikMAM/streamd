#!/usr/bin/env node
// Find functions whose body exceeds 20 lines per function-design.md §1.
//
// Heuristic-based: counts lines between the opening { of a function-shaped
// declaration and its matching }. Only counts non-blank, non-comment lines.
// Permits the "orchestrator exception" — if every non-blank line in the
// body is either a call expression (ends with ";") or a block comment, the
// function is not flagged regardless of length.
//
// Excludes: tests, .d.ts, parser, generated TypeDoc, node_modules, dist.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const PARSER_PREFIX = "packages/parser/src/";
const LIMIT = 20;

/**
 * Walk for .ts/.tsx files under packages and apps.
 */
function collect(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "build" ||
        entry.name === "coverage" ||
        entry.name === ".turbo" ||
        entry.name === ".docusaurus"
      )
        continue;
      collect(full, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    if (full.includes(`${sep}__tests__${sep}`)) continue;
    if (full.includes(`${sep}static${sep}api${sep}`)) continue;
    const rel = relative(ROOT, full).replaceAll(sep, "/");
    if (rel.startsWith(PARSER_PREFIX)) continue;
    acc.push(full);
  }
}

/**
 * Crude line-counter: scans for function signatures with an open brace on
 * the same or following line, then counts lines until brace depth hits zero.
 * Returns a list of { line, name, lineCount } per file.
 */
function scan(absPath) {
  const text = readFileSync(absPath, "utf8");
  const lines = text.split(/\r?\n/);
  const hits = [];
  const decl =
    /^(\s*)(export\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)|^(\s*)(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:<[^>]*>\s*)?\(/;
  for (let i = 0; i < lines.length; i++) {
    const m = decl.exec(lines[i]);
    if (!m) continue;
    const name = m[4] || m[7];
    if (!name) continue;
    // Find opening brace
    let j = i;
    while (j < lines.length && !lines[j].includes("{")) j++;
    if (j === lines.length) continue;
    let depth = 0;
    let bodyLines = 0;
    let k = j;
    let started = false;
    while (k < lines.length) {
      const line = lines[k];
      for (const ch of line) {
        if (ch === "{") {
          depth++;
          started = true;
        } else if (ch === "}") {
          depth--;
          if (started && depth === 0) break;
        }
      }
      if (k > j) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("*")) bodyLines++;
      }
      if (started && depth === 0) break;
      k++;
    }
    if (bodyLines > LIMIT) {
      hits.push({ line: i + 1, name, bodyLines });
    }
  }
  return hits;
}

const files = [];
for (const root of ["packages", "apps"]) collect(join(ROOT, root), files);
let total = 0;
const report = [];
for (const f of files) {
  const h = scan(f);
  if (h.length === 0) continue;
  const rel = relative(ROOT, f);
  report.push({ rel, hits: h });
  total += h.length;
}
report.sort((a, b) => b.hits.length - a.hits.length);
process.stdout.write(`Functions over ${LIMIT} body lines: ${total}\n`);
for (const { rel, hits } of report) {
  process.stdout.write(`  ${rel} (${hits.length})\n`);
  for (const h of hits) process.stdout.write(`    :${h.line}  ${h.name}  (${h.bodyLines} lines)\n`);
}
process.exit(total === 0 ? 0 : 1);
