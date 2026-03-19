/**
 * Unified benchmark suite for @streamd/parser.
 *
 * Compares @streamd/parser against marked, markdown-it, and commonmark.js
 * across synthetic and real-world inputs.
 *
 * Usage: npx tsx packages/bench/src/index.ts
 *
 * @module bench/index
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as streamdParse } from "@streamd/parser";
import { generateMixed } from "./generate";
import { type BenchResult, bench } from "./runner";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleMd = readFileSync(resolve(__dirname, "../fixtures/sample.md"), "utf8");

/** All parsers under test. */
const parsers = [{ name: "@streamd/parser", fn: (s: string) => streamdParse(s) }];

/** All inputs to benchmark. */
const inputs = [
  { label: "Synthetic 1 KB", src: generateMixed(1), warmup: 200, iter: 2000 },
  { label: "Synthetic 50 KB", src: generateMixed(50), warmup: 100, iter: 500 },
  { label: "Synthetic 500 KB", src: generateMixed(500), warmup: 20, iter: 100 },
  {
    label: `Real-world ${(sampleMd.length / 1024).toFixed(1)} KB`,
    src: sampleMd,
    warmup: 200,
    iter: 2000,
  },
  { label: "Pathological *x10000", src: "*".repeat(10000), warmup: 100, iter: 1000 },
  { label: "Pathological >x200", src: "> ".repeat(200) + "text", warmup: 100, iter: 1000 },
];

function printTable(rows: Array<Array<string>>): void {
  const cols = rows[0]!.length;
  const widths: Array<number> = [];
  for (let c = 0; c < cols; c++) {
    let max = 0;
    for (const row of rows) {
      if (row[c]!.length > max) max = row[c]!.length;
    }
    widths.push(max);
  }

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r]!.map((cell, c) =>
      c === 0 ? cell.padEnd(widths[c]!) : cell.padStart(widths[c]!),
    );
    console.log(`| ${cells.join(" | ")} |`);
    if (r === 0) {
      console.log(`|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`);
    }
  }
}

async function main(): Promise<void> {
  const { marked } = await import("marked");
  const MarkdownIt = (await import("markdown-it")).default;
  const { Parser: CmParser } = await import("commonmark");

  const md = new MarkdownIt();
  const cmParser = new CmParser();

  const allParsers = [
    ...parsers,
    { name: "marked", fn: (s: string) => marked.lexer(s) },
    { name: "markdown-it", fn: (s: string) => md.parse(s, {}) },
    { name: "commonmark.js", fn: (s: string) => cmParser.parse(s) },
  ];

  console.log("@streamd/parser benchmark suite\n");

  const header = ["Input", ...allParsers.map((p) => p.name)];
  const rows: Array<Array<string>> = [header];

  for (const { label, src, warmup, iter } of inputs) {
    const results: Array<BenchResult> = [];
    for (const parser of allParsers) {
      results.push(bench(parser.name, parser.fn, src, warmup, iter));
    }

    const row = [
      `${label} (${(src.length / 1024).toFixed(1)} KB)`,
      ...results.map((r) => `${r.throughput.toFixed(1)} MB/s`),
    ];
    rows.push(row);
  }

  printTable(rows);

  console.log("\n--- Detailed latency ---\n");

  const latencyHeader = ["Input", "Parser", "Median", "p95"];
  const latencyRows: Array<Array<string>> = [latencyHeader];

  for (const { label, src, warmup, iter } of inputs) {
    for (const parser of allParsers) {
      const r = bench(parser.name, parser.fn, src, warmup, iter);
      latencyRows.push([label, parser.name, `${r.median.toFixed(3)}ms`, `${r.p95.toFixed(3)}ms`]);
    }
  }

  printTable(latencyRows);
}

main();
