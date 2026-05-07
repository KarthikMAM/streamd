/**
 * Capture a fresh benchmark run and emit structured JSON.
 *
 * Usage:
 *   # Print JSON to stdout
 *   npx tsx packages/bench/src/capture.ts
 *
 *   # Write to a file
 *   npx tsx packages/bench/src/capture.ts --out=/tmp/current.json
 *
 *   # With GC-between-cases for cleaner heap numbers
 *   node --expose-gc --import tsx packages/bench/src/capture.ts --out=/tmp/current.json
 *
 * @module bench/capture
 */
import { writeFileSync } from "node:fs";
import { buildBaseline } from "./schema";
import { runAllBenches } from "./structured-runner";
import type { ParseArgsResult } from "./types";

/**
 * Parse the `--out=<path>` argument from argv. Returns an empty object when
 * the flag is absent (caller writes JSON to stdout instead of a file).
 *
 * @param argv Arguments after `process.argv.slice(2)`.
 */
function parseArgs(argv: ReadonlyArray<string>): ParseArgsResult {
  for (const a of argv) {
    if (a.startsWith("--out=")) return { outPath: a.slice("--out=".length) };
  }
  return {};
}

const args = parseArgs(process.argv.slice(2));
const records = runAllBenches();
const doc = buildBaseline(records);
const serialized = `${JSON.stringify(doc, null, 2)}\n`;

if (args.outPath) {
  writeFileSync(args.outPath, serialized);
  console.log(`captured ${records.length} records → ${args.outPath}`);
} else {
  process.stdout.write(serialized);
}
