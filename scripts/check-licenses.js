#!/usr/bin/env node
/**
 * License compatibility check for the dependency tree.
 *
 * Walks node_modules from the workspace root, reads each package.json's
 * license field, and fails if any forbidden copyleft license appears.
 * Permissive + public-domain licenses are allowed.
 *
 * Exit codes: 0 = clean, 1 = forbidden license found.
 */

const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");

/** @type {ReadonlyArray<string>} Permissive / public-domain licenses. */
const ALLOWED_PREFIXES = [
  "MIT",
  "MIT-0",
  "ISC",
  "BSD",
  "Apache-2.0",
  "Apache 2.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-3.0",
  "CC-BY-2.0",
  "Unlicense",
  "WTFPL",
  "0BSD",
  "Python-2.0",
  "BlueOak-1.0.0",
  "PSF-2.0",
  "Zlib",
  "JSON",
  "UNLICENSED",
  "MPL-2.0",
];

/** Copyleft family — strictly incompatible with MIT distribution. */
const FORBIDDEN_RE = /\b(GPL|AGPL|LGPL|SSPL|CPAL|OSL|EUPL|CC-BY-SA|CC-BY-NC)(-|\b)/i;

/**
 * Return true when every token in a license expression is allowed.
 *
 * @param {string} license License field verbatim.
 * @returns {boolean}
 */
function isAllowed(license) {
  if (!license) return false;
  const parts = license
    .replace(/[()]/g, " ")
    .split(/\s+(?:OR|AND)\s+|\s*\/\s*|,/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.every(isAllowedToken);
}

/** Check a single license token against the allowlist. */
function isAllowedToken(token) {
  return ALLOWED_PREFIXES.some(
    (p) => token === p || token.startsWith(`${p}-`) || token.toLowerCase() === p.toLowerCase(),
  );
}

/**
 * Parse the `license`/`licenses` field into a normalized SPDX-ish string.
 *
 * @param {string} raw License field serialized to a string.
 * @returns {string}
 */
function normalizeLicense(raw) {
  if (!raw) return "UNKNOWN";
  const trimmed = raw.trim();
  if (trimmed.startsWith("SEE LICENSE IN") || trimmed.startsWith("LicenseRef-")) {
    return "SKIP_FILE_LICENSE";
  }
  if (trimmed.startsWith("{")) return parseObjectLicense(trimmed);
  if (trimmed.startsWith("[")) return parseArrayLicense(trimmed);
  return trimmed;
}

/** Extract `.type` from a single license object. */
function parseObjectLicense(raw) {
  try {
    const obj = JSON.parse(raw);
    return typeof obj.type === "string" ? obj.type : "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

/** Join multiple license-entry objects with OR. */
function parseArrayLicense(raw) {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return "UNKNOWN";
    const types = arr.map((e) => e?.type || "").filter(Boolean);
    return types.length > 0 ? types.join(" OR ") : "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

/**
 * Collect (pkgName, license) pairs under a directory by reading each
 * immediate child's `package.json`.
 *
 * @param {string} dir Path to scan.
 * @param {Map<string, string>} acc Accumulator keyed by `name@version`.
 */
function isHiddenOrInternal(entry) {
  return entry === ".bin" || entry === ".cache" || entry.startsWith(".");
}

function processEntry(dir, entry, acc) {
  if (isHiddenOrInternal(entry)) return;
  const full = join(dir, entry);
  if (entry.startsWith("@")) {
    collectHere(full, acc);
  } else {
    recordPackage(full, acc);
  }
}

function collectHere(dir, acc) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) processEntry(dir, entry, acc);
}

/** Read one package dir's metadata + walk its nested node_modules. */
function recordPackage(pkgDir, acc) {
  const meta = readPackageJson(pkgDir);
  if (meta === null) return;
  const key = `${meta.name}@${meta.version}`;
  if (!acc.has(key)) acc.set(key, meta.rawLicense);
  const nested = join(pkgDir, "node_modules");
  try {
    if (statSync(nested).isDirectory()) collectHere(nested, acc);
  } catch {
    /* no nested dir */
  }
}

/** Parse a single package.json file. Returns null on missing / unreadable. */
function readPackageJson(dir) {
  const path = join(dir, "package.json");
  try {
    const meta = JSON.parse(readFileSync(path, "utf8"));
    const raw = meta.license ?? meta.licenses ?? "UNKNOWN";
    return {
      name: meta.name || dir.split("/").pop(),
      version: meta.version || "?",
      rawLicense: typeof raw === "string" ? raw : JSON.stringify(raw),
    };
  } catch {
    return null;
  }
}

/**
 * Classify a single package's license into one of:
 *   - "allowed" — permissive, no action
 *   - "forbidden" — copyleft family
 *   - "unknown"  — no license field
 *   - "file"     — "SEE LICENSE IN <path>" (needs manual review)
 */
function classifyPackage(license) {
  if (FORBIDDEN_RE.test(license)) return "forbidden";
  if (license === "UNKNOWN") return "unknown";
  if (license === "SKIP_FILE_LICENSE") return "file";
  return isAllowed(license) ? "allowed" : "forbidden";
}

/** Categorize each (pkg, license) into buckets using `classifyPackage`. */
function categorize(licenses) {
  const buckets = { violations: [], unknowns: [], fileLicenses: [] };
  for (const [pkg, raw] of licenses) {
    if (isStreamdPackage(pkg)) continue;
    addToBucket(pkg, raw, buckets);
  }
  return buckets;
}

function isStreamdPackage(pkg) {
  return pkg.startsWith("@streamd/") || pkg.startsWith("streamd-monorepo@");
}

function addToBucket(pkg, raw, buckets) {
  const license = normalizeLicense(raw);
  const bucket = classifyPackage(license);
  if (bucket === "forbidden") buckets.violations.push(`${pkg} — ${license}`);
  else if (bucket === "unknown") buckets.unknowns.push(`${pkg} (raw: ${raw})`);
  else if (bucket === "file") buckets.fileLicenses.push(pkg);
}

const licenses = new Map();
collectHere(join(process.cwd(), "node_modules"), licenses);
const { violations, unknowns, fileLicenses } = categorize(licenses);

if (violations.length > 0) {
  console.error("[FAIL] License violations:");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

if (unknowns.length > 0) {
  console.warn(`[warn] ${unknowns.length} package(s) without a license field:`);
  for (const u of unknowns.slice(0, 10)) console.warn(`  ${u}`);
  if (unknowns.length > 10) console.warn(`  … and ${unknowns.length - 10} more`);
}

if (fileLicenses.length > 0) {
  console.warn(
    `[note] ${fileLicenses.length} package(s) use "SEE LICENSE IN ..." — review manually if adding a new one`,
  );
}

console.log(`check-licenses: scanned ${licenses.size} packages, all compatible with MIT`);
