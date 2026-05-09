#!/usr/bin/env node
/**
 * Package-metadata consistency check.
 *
 * Every published @streamd/* package must agree on:
 *  - version (linked via changesets)
 *  - license
 *  - engines.node
 *  - publishConfig.access
 *  - repository.url and author
 *  - files array (["dist", "README.md", "LICENSE"])
 *  - exports shape (import/require with correct dual-types pointers)
 *
 * Exit 0 = clean, 1 = inconsistency found.
 */

const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const PUBLISHED = [
  "parser",
  "tokens",
  "html",
  "plugins",
  "react",
  "react-native",
  "plugin-shiki",
  "cli",
];
// Pure-ESM packages skip the require.types assertion (no CJS entry by design).
const ESM_ONLY = new Set(["cli"]);
const EXPECTED_FILES = new Set(["dist", "README.md", "LICENSE"]);

function load(pkg) {
  const p = join("packages", pkg, "package.json");
  if (!existsSync(p)) return null;
  return { name: pkg, path: p, meta: JSON.parse(readFileSync(p, "utf8")) };
}

const pkgs = PUBLISHED.map(load).filter(Boolean);
const errors = [];

function collectField(field) {
  return pkgs.map((p) => ({ name: p.name, value: get(p.meta, field) }));
}

function get(obj, path) {
  return path.split(".").reduce((o, key) => (o == null ? undefined : o[key]), obj);
}

/**
 * Assert the named field is identical across all packages. Records an
 * error in the shared `errors` list and returns true on mismatch.
 */
function assertSame(field) {
  const values = collectField(field);
  const first = JSON.stringify(values[0].value);
  const mismatched = values.filter((v) => JSON.stringify(v.value) !== first);
  if (mismatched.length === 0) return false;
  errors.push(`Field "${field}" differs:`);
  for (const v of values) errors.push(`  ${v.name.padEnd(14)} → ${JSON.stringify(v.value)}`);
  return true;
}

function filesMatchExpected(files) {
  const set = new Set(files);
  return set.size === EXPECTED_FILES.size && [...EXPECTED_FILES].every((x) => set.has(x));
}

/** Assert the `files` array is exactly the expected set (order-independent). */
function assertFiles() {
  for (const p of pkgs) {
    const files = p.meta.files;
    if (!Array.isArray(files)) {
      errors.push(`${p.name}: "files" must be an array`);
      continue;
    }
    if (!filesMatchExpected(files)) {
      errors.push(
        `${p.name}: files should be ${JSON.stringify([...EXPECTED_FILES])}, got ${JSON.stringify(files)}`,
      );
    }
  }
}

/** Assert repository.directory points at the right sub-folder per package. */
function assertRepositoryDirectory() {
  for (const p of pkgs) {
    const dir = get(p.meta, "repository.directory");
    const expected = `packages/${p.name}`;
    if (dir !== expected) {
      errors.push(
        `${p.name}: repository.directory should be "${expected}", got ${JSON.stringify(dir)}`,
      );
    }
  }
}

function getExportsDot(meta) {
  const exports = get(meta, "exports");
  return exports ? exports["."] : undefined;
}

/** Assert exports.dot.import.types points at the .d.mts that tsdown emits. */
function assertExports() {
  for (const p of pkgs) {
    const dot = getExportsDot(p.meta);
    const importTypes = dot?.import?.types;
    const requireTypes = dot?.require?.types;
    if (importTypes !== "./dist/index.d.mts") {
      errors.push(
        `${p.name}: exports["."].import.types should be "./dist/index.d.mts", got ${JSON.stringify(importTypes)}`,
      );
    }
    if (ESM_ONLY.has(p.name)) continue;
    if (requireTypes !== "./dist/index.d.cts") {
      errors.push(
        `${p.name}: exports["."].require.types should be "./dist/index.d.cts", got ${JSON.stringify(requireTypes)}`,
      );
    }
  }
}

assertSame("version");
assertSame("license");
assertSame("engines.node");
assertSame("publishConfig.access");
assertSame("author");
assertSame("repository.type");
assertSame("repository.url");
assertSame("bugs.url");
assertFiles();
assertRepositoryDirectory();
assertExports();

if (errors.length > 0) {
  console.error("[FAIL] Package metadata inconsistency:");
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(`check-package-metadata: ${pkgs.length} published packages consistent`);
