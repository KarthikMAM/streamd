/**
 * Profile streaming paths — identifies where time is spent per chunk.
 *
 * Usage: npx tsx packages/bench/src/profile-streaming.ts
 *
 * @module bench/profile-streaming
 */
import { parse as streamdParse } from "@streamd/parser";
import { generateMixed } from "./generate";

function fmtNs(ns: number): string {
  if (ns < 1000) return ns.toFixed(0) + " ns";
  if (ns < 1_000_000) return (ns / 1000).toFixed(1) + " µs";
  return (ns / 1_000_000).toFixed(2) + " ms";
}

interface ProfileResult {
  label: string;
  totalChunks: number;
  medianNs: number;
  p99Ns: number;
  minNs: number;
  maxNs: number;
}

function profileStreaming(
  label: string,
  src: string,
  chunkSize: number,
  warmup: number,
  iterations: number,
): ProfileResult {
  const chunks: Array<string> = [];
  for (let i = 0; i < src.length; i += chunkSize) {
    chunks.push(src.slice(i, Math.min(i + chunkSize, src.length)));
  }
  const numChunks = chunks.length;

  // Warmup
  for (let w = 0; w < warmup; w++) {
    let state: unknown = null;
    let acc = "";
    for (let c = 0; c < numChunks; c++) {
      acc += chunks[c]!;
      state = (streamdParse(acc, state as null) as { state: unknown }).state;
    }
  }

  // Measure per-chunk times
  const times: Array<number> = [];
  for (let iter = 0; iter < iterations; iter++) {
    let state: unknown = null;
    let acc = "";
    for (let c = 0; c < numChunks; c++) {
      acc += chunks[c]!;
      const t0 = performance.now();
      state = (streamdParse(acc, state as null) as { state: unknown }).state;
      const elapsed = (performance.now() - t0) * 1_000_000; // ns
      times.push(elapsed);
    }
  }

  times.sort((a, b) => a - b);
  return {
    label,
    totalChunks: numChunks,
    medianNs: times[Math.floor(times.length / 2)]!,
    p99Ns: times[Math.floor(times.length * 0.99)]!,
    minNs: times[0]!,
    maxNs: times[times.length - 1]!,
  };
}

function printResults(results: Array<ProfileResult>): void {
  const rows: Array<Array<string>> = [["Scenario", "Chunks", "Median", "p99", "Min", "Max"]];
  for (const r of results) {
    rows.push([
      r.label,
      String(r.totalChunks),
      fmtNs(r.medianNs),
      fmtNs(r.p99Ns),
      fmtNs(r.minNs),
      fmtNs(r.maxNs),
    ]);
  }
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
    if (r === 0) console.log(`|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`);
  }
}

// ── Plain text (text-append fast path) ────────────────────────
console.log("=== Text-Append Fast Path (pure words, no newlines) ===\n");

const plainText = "The quick brown fox jumps over the lazy dog and keeps running forever. ".repeat(
  150,
);
printResults([
  profileStreaming("3B chunks", plainText, 3, 20, 50),
  profileStreaming("10B chunks", plainText, 10, 20, 50),
  profileStreaming("50B chunks", plainText, 50, 20, 50),
]);

// ── Fenced code (fence-check fast path) ───────────────────────
console.log("\n=== Fenced Code Fast Path ===\n");

const codeBlock = "```js\n" + "const x = 1;\n".repeat(800) + "```\n";
printResults([
  profileStreaming("3B chunks", codeBlock, 3, 20, 50),
  profileStreaming("10B chunks", codeBlock, 10, 20, 50),
  profileStreaming("50B chunks", codeBlock, 50, 20, 50),
]);

// ── Paragraph with bold (inline re-parse) ─────────────────────
console.log("\n=== Paragraph with Inline Formatting (re-parse path) ===\n");

const boldPara = "This is text with **bold** and *italic* markers. ".repeat(200);
printResults([
  profileStreaming("1KB para, 50B", boldPara.slice(0, 1024), 50, 20, 100),
  profileStreaming("5KB para, 50B", boldPara.slice(0, 5120), 50, 20, 50),
  profileStreaming("10KB para, 50B", boldPara.slice(0, 10240), 50, 20, 30),
]);

// ── Mixed markdown (all paths) ────────────────────────────────
console.log("\n=== Mixed Markdown (all fast paths) ===\n");

printResults([
  profileStreaming("1KB mixed, 3B", generateMixed(1), 3, 20, 100),
  profileStreaming("10KB mixed, 50B", generateMixed(10), 50, 20, 50),
  profileStreaming("50KB mixed, 50B", generateMixed(50), 50, 20, 30),
]);

// ── Newline-heavy paragraph (softbreak handling) ──────────────
console.log("\n=== Paragraph with Newlines (softbreak tokens) ===\n");

const newlinePara = "Line of text here\n".repeat(600);
printResults([profileStreaming("10KB, 50B chunks", newlinePara.slice(0, 10240), 50, 20, 50)]);

// ── concatTokens overhead ─────────────────────────────────────
console.log("\n=== After Many Completed Blocks (concatTokens scaling) ===\n");

// Many short blocks followed by streaming paragraph
const manyBlocks = "# H\n\n".repeat(200) + "Streaming paragraph ";
const manyBlocksSrc = manyBlocks + "word ".repeat(100);
printResults([profileStreaming("200 completed + para, 5B", manyBlocksSrc, 5, 10, 50)]);
