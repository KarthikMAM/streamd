#!/usr/bin/env node
/**
 * Fetch spec fixtures from upstream and write flat .md/.html pairs.
 *
 * Sources:
 *   commonmark/ — commonmark/commonmark-spec (spec.txt)
 *   gfm/       — github/cmark-gfm (spec + extensions + regressions)
 *
 * Usage: npm run sync
 */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Config ──

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(SCRIPT_DIR, "..", "fixtures");
const EXAMPLE_FENCE = "````````````````````````````````";

const COMMONMARK_URL = "https://raw.githubusercontent.com/commonmark/commonmark-spec/master";
const GFM_URL = "https://raw.githubusercontent.com/github/cmark-gfm/master/test";

// ── Helpers ──

function toSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function zeroPad(number, width = 4) {
  return String(number).padStart(width, "0");
}

function downloadFile(url) {
  return execSync(`curl -fsSL "${url}"`, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
  });
}

// ── Parser for CommonMark/GFM spec.txt format ──

function extractExamples(specContent) {
  const examples = [];
  const lines = specContent.split("\n");

  let currentSection = "";
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith("#")) {
      currentSection = line.replace(/^#+\s*/, "").trim();
      index++;
      continue;
    }

    if (line.startsWith(`${EXAMPLE_FENCE} example`)) {
      index++;

      let markdownInput = "";
      while (index < lines.length && lines[index] !== ".") {
        markdownInput += `${lines[index]}\n`;
        index++;
      }
      index++; // skip "." separator

      let expectedHtml = "";
      while (index < lines.length && !lines[index].startsWith(EXAMPLE_FENCE)) {
        expectedHtml += `${lines[index]}\n`;
        index++;
      }
      index++; // skip closing fence

      examples.push({
        section: currentSection,
        markdown: markdownInput,
        html: expectedHtml,
      });
      continue;
    }

    index++;
  }

  return examples;
}

// ── Write fixtures to disk ──

function writeFixtures(examples, outputDir) {
  mkdirSync(outputDir, { recursive: true });

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    const fileName = `${zeroPad(i + 1)}--${toSlug(example.section)}`;

    writeFileSync(join(outputDir, `${fileName}.md`), example.markdown);
    writeFileSync(join(outputDir, `${fileName}.html`), example.html);
  }

  console.log(`  ${examples.length} examples → ${outputDir}`);
}

// ── Main ──

rmSync(FIXTURES_DIR, { recursive: true, force: true });

console.log("CommonMark 0.31.2");
const commonmarkExamples = extractExamples(downloadFile(`${COMMONMARK_URL}/spec.txt`));
writeFixtures(commonmarkExamples, join(FIXTURES_DIR, "commonmark"));

console.log("GFM 0.29");
const gfmExamples = [
  ...extractExamples(downloadFile(`${GFM_URL}/spec.txt`)),
  ...extractExamples(downloadFile(`${GFM_URL}/extensions.txt`)),
  ...extractExamples(downloadFile(`${GFM_URL}/extensions-table-prefer-style-attributes.txt`)),
  ...extractExamples(downloadFile(`${GFM_URL}/extensions-full-info-string.txt`)),
  ...extractExamples(downloadFile(`${GFM_URL}/regression.txt`)),
];
writeFixtures(gfmExamples, join(FIXTURES_DIR, "gfm"));

console.log(`\nDone. ${commonmarkExamples.length + gfmExamples.length} total fixtures.`);
