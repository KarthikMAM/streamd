#!/usr/bin/env node
// Audit JSDoc coverage across the streamd monorepo per code-quality §2.1.
//
// Scope rules:
//   - Source TypeScript / TSX under packages/* and apps/*.
//   - Excludes tests (*.test.ts, __tests__/), ambient declarations (*.d.ts),
//     build outputs (dist/, build/), and node_modules.
//   - packages/parser/src/** follows parser-conventions.md (module-level JSDoc
//     on every file + JSDoc on every *exported* declaration). Private helpers
//     are exempt there, per ADR 0001 context.
//   - Every other source file: JSDoc required on every function, method,
//     class, interface, and type alias — public AND private.
//
// Declarations detected:
//   - 'function name(...)' / 'export function name(...)'
//   - 'export const name = (...) => ...' or 'export const name: T = (...) => ...'
//   - 'const name = (...) => ...' at top level (module scope)
//   - 'class Name' / 'export class Name'
//   - Class methods (non-constructor, non-getter/setter/accessor nuances handled)
//   - 'interface Name' / 'export interface Name'
//   - 'type Name = ...' / 'export type Name = ...'
//
// A declaration is considered documented when the line immediately above it
// (skipping blank lines only) ends with a block-comment close (star-slash) — i.e. a JSDoc block closer.
// Single-line '// ...' comments do NOT count as JSDoc.
//
// A file is considered to have a module-level JSDoc when its first
// non-empty, non-shebang, non-"use strict" line starts a the opening tag of a JSDoc block block
// that is not attached to a declaration.
//
// Usage:
//   node scripts/jsdoc-audit.mjs                # summary + per-file counts
//   node scripts/jsdoc-audit.mjs --verbose      # list every missing item
//   node scripts/jsdoc-audit.mjs --json         # machine-readable output
//   node scripts/jsdoc-audit.mjs --package=html # scope to one package
//
// Exit code is 0 when total missing is 0, 1 otherwise.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const ARGS = process.argv.slice(2);
const VERBOSE = ARGS.includes("--verbose");
const JSON_OUT = ARGS.includes("--json");
const PACKAGE_FILTER = (() => {
  const flag = ARGS.find((arg) => arg.startsWith("--package="));
  return flag ? flag.slice("--package=".length) : null;
})();

const ROOTS = ["packages", "apps"];

const PARSER_PREFIX = `packages${sep}parser${sep}src${sep}`;

/**
 * Recursively walk a directory and collect TypeScript source files we audit.
 *
 * @param dir Absolute directory path.
 * @param acc Mutable accumulator of absolute file paths.
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
      ) {
        continue;
      }
      collect(full, acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    if (full.includes(`${sep}__tests__${sep}`)) continue;
    if (full.includes(`${sep}static${sep}api${sep}`)) continue;
    acc.push(full);
  }
}

/**
 * Return true when the previous non-empty line ends with a block-comment close (star-slash).
 *
 * @param lines Full file split by newline.
 * @param index Index of the declaration line (0-based).
 */
function hasJsDocAbove(lines, index) {
  let i = index - 1;
  while (i >= 0 && lines[i].trim() === "") i--;
  if (i < 0) return false;
  return lines[i].trim().endsWith("*/");
}

/**
 * Return true when the file begins with a the opening tag of a JSDoc block module-level block.
 *
 * @param text Full file text.
 */
function hasModuleJsDoc(text) {
  const stripped = text.replace(/^\uFEFF/, "");
  const trimmed = stripped.replace(/^#![^\n]*\n/, "").replace(/^\s+/, "");
  return trimmed.startsWith("/**");
}

const DECL_PATTERNS = [
  {
    kind: "function",
    // function foo(...) / export function foo(...) / export async function foo
    regex: /^(\s*)(export\s+)?(async\s+)?function\s+([A-Za-z_$][\w$]*)/,
    exportedGroup: 2,
    nameGroup: 4,
  },
  {
    kind: "class",
    regex: /^(\s*)(export\s+)?(abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
    exportedGroup: 2,
    nameGroup: 4,
  },
  {
    kind: "interface",
    regex: /^(\s*)(export\s+)?interface\s+([A-Za-z_$][\w$]*)/,
    exportedGroup: 2,
    nameGroup: 3,
  },
  {
    kind: "type",
    regex: /^(\s*)(export\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/,
    exportedGroup: 2,
    nameGroup: 3,
  },
  {
    // Top-level arrow-function-valued consts: export const name = (...) => ...
    // Tolerates an optional ": Type" annotation between the name and the "=".
    kind: "const-arrow",
    regex:
      /^(\s*)(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:<[^>]*>\s*)?\(/,
    exportedGroup: 2,
    nameGroup: 3,
  },
];

/**
 * Detect whether a line starts a class method that needs JSDoc.
 *
 * Skips: the 'constructor', single-line field declarations (no '('), getters
 * written as properties, lines that are part of a signature continuation.
 *
 * @param line Raw line text.
 */
function matchClassMethod(line) {
  const methodRe =
    /^(\s{2,})(public\s+|private\s+|protected\s+|readonly\s+|static\s+|override\s+|abstract\s+|async\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/;
  const match = methodRe.exec(line);
  if (!match) return null;
  const name = match[3];
  if (name === "constructor") return null;
  if (
    name === "if" ||
    name === "for" ||
    name === "while" ||
    name === "switch" ||
    name === "return" ||
    name === "super" ||
    name === "throw" ||
    name === "catch" ||
    name === "yield" ||
    name === "await" ||
    name === "typeof" ||
    name === "delete" ||
    name === "void" ||
    name === "in" ||
    name === "of"
  )
    return null;
  return { indent: match[1], name };
}

/**
 * Return the set of missing-doc items for a single source file.
 *
 * @param absPath Absolute file path.
 */
function auditFile(absPath) {
  const rel = relative(ROOT, absPath);
  const text = readFileSync(absPath, "utf8");
  const lines = text.split(/\r?\n/);
  const isParser = rel.startsWith(PARSER_PREFIX);
  const isBarrel = /(^|\/)index\.ts$/.test(rel);

  const missing = [];
  let insideClass = 0;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Crude brace depth tracking to know when we're inside a class body.
    // This works for well-formatted TS but may over/under-count inside
    // multi-line strings. Good enough for a coverage heuristic.
    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;

    let matched = null;
    for (const { kind, regex, exportedGroup, nameGroup } of DECL_PATTERNS) {
      const m = regex.exec(line);
      if (m) {
        // For const-arrow, validate by checking that the RHS is actually an
        // arrow function within the next 8 lines. Otherwise this regex
        // matches expressions like `const Foo = (await import(...)).default;`.
        if (kind === "const-arrow") {
          const isArrow = (() => {
            if (/;\s*$/.test(line) && !/=>/.test(line)) return false;
            const tail = lines.slice(i, i + 8).join("\n");
            return /\)\s*(?::[^={;]+)?\s*=>/.test(tail);
          })();
          if (!isArrow) continue;
        }
        matched = {
          kind,
          name: m[nameGroup],
          exported: Boolean(m[exportedGroup]),
        };
        break;
      }
    }

    if (matched) {
      const enforceHere = isParser ? matched.exported : true;
      if (enforceHere && !hasJsDocAbove(lines, i)) {
        missing.push({
          line: i + 1,
          kind: matched.kind,
          name: matched.name,
          scope: matched.exported ? "exported" : "private",
        });
      }
    } else if (insideClass > 0) {
      const method = matchClassMethod(line);
      if (method && !hasJsDocAbove(lines, i)) {
        // In parser code, enforce only on methods of an exported class (we
        // conservatively enforce on all class methods since classes are rare
        // in parser).
        missing.push({
          line: i + 1,
          kind: "method",
          name: method.name,
          scope: "method",
        });
      }
    }

    if (matched && matched.kind === "class") {
      insideClass++;
    }

    braceDepth += openCount - closeCount;
    if (insideClass > 0 && braceDepth <= 0) {
      insideClass = Math.max(0, insideClass - 1);
      braceDepth = 0;
    }
  }

  const issues = [...missing];
  if (!(isBarrel || hasModuleJsDoc(text))) {
    issues.push({
      line: 1,
      kind: "module",
      name: rel.split(sep).pop(),
      scope: "file",
    });
  }
  return { rel, isParser, issues };
}

/**
 * Enumerate source files under ROOTS respecting the --package filter.
 */
function listSourceFiles() {
  const files = [];
  for (const root of ROOTS) {
    collect(join(ROOT, root), files);
  }
  if (!PACKAGE_FILTER) return files;
  const needle = `packages${sep}${PACKAGE_FILTER}${sep}`;
  return files.filter((p) => relative(ROOT, p).startsWith(needle));
}

/**
 * Main entry: audit every file and emit a human or JSON report.
 */
function main() {
  const files = listSourceFiles();
  const perFile = [];
  let total = 0;
  let totalFunctions = 0;
  let totalMethods = 0;
  let totalClasses = 0;
  let totalTypes = 0;
  let totalInterfaces = 0;
  let totalModules = 0;

  for (const file of files) {
    const { rel, isParser, issues } = auditFile(file);
    if (issues.length === 0) continue;
    total += issues.length;
    for (const issue of issues) {
      if (issue.kind === "function" || issue.kind === "const-arrow") totalFunctions++;
      else if (issue.kind === "method") totalMethods++;
      else if (issue.kind === "class") totalClasses++;
      else if (issue.kind === "type") totalTypes++;
      else if (issue.kind === "interface") totalInterfaces++;
      else if (issue.kind === "module") totalModules++;
    }
    perFile.push({ rel, isParser, issues });
  }

  if (JSON_OUT) {
    process.stdout.write(
      `${JSON.stringify(
        {
          total,
          breakdown: {
            functions: totalFunctions,
            methods: totalMethods,
            classes: totalClasses,
            types: totalTypes,
            interfaces: totalInterfaces,
            modules: totalModules,
          },
          files: perFile,
        },
        null,
        2,
      )}\n`,
    );
    process.exit(total === 0 ? 0 : 1);
  }

  const sorted = [...perFile].sort((a, b) => b.issues.length - a.issues.length);
  process.stdout.write(`JSDoc audit (root: ${ROOT})\n`);
  process.stdout.write(`Total missing: ${total}\n`);
  process.stdout.write(
    `  functions+arrows: ${totalFunctions}, methods: ${totalMethods}, ` +
      `classes: ${totalClasses}, interfaces: ${totalInterfaces}, ` +
      `types: ${totalTypes}, module headers: ${totalModules}\n`,
  );
  process.stdout.write(`Files with gaps: ${sorted.length}\n\n`);
  for (const { rel, issues, isParser } of sorted) {
    process.stdout.write(`  ${rel}${isParser ? " [parser]" : ""} (${issues.length})\n`);
    if (!VERBOSE) continue;
    for (const issue of issues) {
      process.stdout.write(`    :${issue.line}  ${issue.kind} ${issue.name}\n`);
    }
  }
  process.exit(total === 0 ? 0 : 1);
}

main();
