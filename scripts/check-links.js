#!/usr/bin/env node
/**
 * Relative-link checker for repo markdown.
 *
 * Scans README.md, CONTRIBUTING.md, STYLE.md, CODE_OF_CONDUCT.md,
 * SECURITY.md plus every packages/<pkg>/README.md for relative links
 * (excluding http://, https://, mailto:, and #fragment-only links).
 * Fails if any link's target path does not exist.
 *
 * Skip anchor-only fragments (#foo) since they refer to headings in
 * the same file.
 */

const { readFileSync, existsSync, readdirSync, statSync } = require("node:fs");
const { dirname, resolve, join } = require("node:path");

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

const EXCLUDE_PREFIXES = [
  "node_modules/",
  "dist/",
  "packages/spec/fixtures/",
  ".kiro/",
  ".changeset/",
  "apps/docs/docs/",
  "apps/docs/static/api/",
  "apps/docs/build/",
  ".git/",
  // Untracked review-agent scratch artifacts live at the repo root and
  // intentionally contain placeholder or external-badge link syntax; they
  // are not part of the shipped documentation surface.
  "review-",
];

function shouldExclude(relPath) {
  for (const prefix of EXCLUDE_PREFIXES) {
    if (relPath.startsWith(prefix) || relPath.includes(`/${prefix}`)) return true;
  }
  return false;
}

function walk(dir, root, acc) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    visitEntry(dir, root, entry, acc);
  }
}

function visitEntry(dir, root, entry, acc) {
  const full = join(dir, entry);
  const rel = full.startsWith(`${root}/`) ? full.slice(root.length + 1) : full;
  if (shouldExclude(rel)) return;
  let stat;
  try {
    stat = statSync(full);
  } catch {
    return;
  }
  if (stat.isDirectory()) walk(full, root, acc);
  else if (entry.endsWith(".md")) acc.push(rel);
}

function findMarkdownFiles() {
  const root = process.cwd();
  const acc = [];
  walk(root, root, acc);
  return acc;
}

function isExternalOrAnchor(href) {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("#") ||
    href.startsWith("data:")
  );
}

function stripAnchor(href) {
  const hash = href.indexOf("#");
  return hash === -1 ? href : href.slice(0, hash);
}

function resolveLocalTarget(href) {
  if (isExternalOrAnchor(href)) return undefined;
  const cleaned = stripAnchor(href);
  if (cleaned === "") return undefined;
  return cleaned;
}

function checkFile(file) {
  const content = readFileSync(file, "utf8");
  const dir = dirname(file);
  const errors = [];
  let match;
  // biome-ignore lint/suspicious/noAssignInExpressions: regex iterator idiom
  while ((match = LINK_RE.exec(content)) !== null) {
    const href = match[2].trim().replace(/^<|>$/g, "");
    const local = resolveLocalTarget(href);
    if (!local) continue;
    const target = resolve(dir, local);
    if (!existsSync(target)) {
      const line = content.slice(0, match.index).split("\n").length;
      errors.push(`${file}:${line} — broken link [${match[1]}](${href}) → ${target}`);
    }
  }
  return errors;
}

const files = findMarkdownFiles();
const failures = [];
for (const file of files) failures.push(...checkFile(file));

if (failures.length > 0) {
  console.error(`[FAIL] ${failures.length} broken link(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`check-links: scanned ${files.length} markdown files, all relative links resolve`);
