#!/usr/bin/env node
/**
 * Build a static single-page HTML demo of @streamd/html.
 *
 * Output: dist/index.html — includes a pre-rendered markdown doc, the
 * raw source, and an inline script that re-parses it chunk-by-chunk to
 * demonstrate the streaming API.
 *
 * This script inlines the compiled ESM bundles for @streamd/parser and
 * @streamd/html. If either bundle is missing, the script prints a
 * pointer to the workspace build command and exits non-zero instead of
 * producing a broken HTML page.
 *
 * @module apps/html-demo/build
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHtml, renderThemeStylesheet } from "@streamd/html";
import { parse } from "@streamd/parser";
import { shiki } from "@streamd/plugin-shiki";
import { darkTheme, lightTheme } from "@streamd/tokens";

/** @type {string} Directory of this script, used as base for all relative path resolution. */
const here = dirname(fileURLToPath(import.meta.url));

/** @type {string} Path to the shared sample markdown used as demo input content. */
const sampleMdPath = resolve(here, "../shared/sample.md");

/** @type {string} Output path for the generated single-page HTML demo. */
const outPath = resolve(here, "dist/index.html");

/** @type {string} Path to the pre-built parser ESM bundle inlined into the demo page. */
const parserBundlePath = resolve(here, "../../packages/parser/dist/index.mjs");

/** @type {string} Path to the pre-built html-renderer ESM bundle inlined into the demo page. */
const htmlBundlePath = resolve(here, "../../packages/html/dist/index.mjs");

/**
 * Read a text file with a human-readable error if it's missing.
 *
 * Exits the process with code 1 when the file does not exist, printing
 * the hint to stderr so the user knows which build step to run.
 *
 * @param {string} path Absolute path to read.
 * @param {string} hint Short message shown when the file is missing, including the
 *   command the user should run to produce it.
 * @returns {Promise<string>} File contents as UTF-8 text.
 */
async function readTextOrExit(path, hint) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    const isNotFound = error?.code === "ENOENT";

    if (isNotFound) {
      console.error(`apps/html-demo: missing ${path}`);
      console.error(`apps/html-demo: ${hint}`);
      process.exit(1);
    }
    throw error;
  }
}

/** @type {string} Raw markdown content used for both pre-rendering and the streaming replay. */
const sampleMd = await readTextOrExit(
  sampleMdPath,
  "Ensure apps/shared/sample.md exists — it is the demo input.",
);

/** @type {string} Full ESM source of @streamd/parser, inlined as a script module in the page. */
const parserBundle = await readTextOrExit(
  parserBundlePath,
  "Run `npm run build -w @streamd/parser` (or `npm run build` from the repo root) first.",
);

/** @type {string} Full ESM source of @streamd/html, inlined as a script module in the page. */
const htmlBundle = await readTextOrExit(
  htmlBundlePath,
  "Run `npm run build -w @streamd/html` (or `npm run build` from the repo root) first.",
);

/**
 * Shiki plugin instance — annotates CodeBlock tokens with structured
 * `meta.highlight` (HighlightData) for styled-span rendering.
 */
const shikiPlugin = await shiki({
  langs: ["javascript", "typescript", "bash", "json"],
  themes: { light: "github-light", dark: "github-dark" },
});

/** @type {string} Server-side rendered HTML of the sample markdown with Shiki highlighting. */
const preRendered = renderHtml(parse(sampleMd, null, { gfm: true }).tokens, {
  classPrefix: "streamd",
  plugins: [shikiPlugin],
});

/**
 * Render the sample with a custom `code_block` component override that
 * wraps code in a header showing the language badge. Demonstrates the
 * component-override extensibility mechanism.
 */
const overrideRendered = renderHtml(parse(sampleMd, null, { gfm: true }).tokens, {
  classPrefix: "streamd",
  plugins: [shikiPlugin],
  components: {
    code_block: (token, ctx) => {
      const lang = token.lang || "text";
      const badge = `<span class="lang-badge">${ctx.escapeHtml(lang)}</span>`;
      const highlight = token.meta?.highlight;
      let codeContent;
      if (highlight) {
        codeContent = highlight.lines
          .map((line) =>
            line
              .map(
                (seg) =>
                  `<span style="color:${seg.color ?? ""}">${ctx.escapeHtml(seg.text)}</span>`,
              )
              .join(""),
          )
          .join("\n");
      } else {
        codeContent = ctx.escapeHtml(token.content);
      }
      return `<div class="code-override">${badge}<pre><code>${codeContent}</code></pre></div>`;
    },
  },
});

/**
 * KaTeX-via-component-override recipe: demonstrates how consumers
 * supply custom math rendering without plugin-katex. In production,
 * the override would call `katex.renderToString(token.content)`.
 * Here we show the pattern with a placeholder.
 */
const katexRecipeHtml = `<div class="recipe-box">
<h3>KaTeX via component override (recipe)</h3>
<pre><code class="language-javascript">import katex from "katex";
import { renderHtml } from "@streamd/html";
import { parse } from "@streamd/parser";

const html = renderHtml(parse(src).tokens, {
  components: {
    math_block: (token) =&gt;
      \`&lt;div class="math-block"&gt;\${katex.renderToString(token.content, { displayMode: true })}&lt;/div&gt;\`,
    math_inline: (token) =&gt;
      \`&lt;span class="math-inline"&gt;\${katex.renderToString(token.content)}&lt;/span&gt;\`,
  },
});</code></pre>
</div>`;

/** @type {string} CSS stylesheet for the light theme, scoped to .streamd-root. */
const lightCss = renderThemeStylesheet(lightTheme);

/** @type {string} CSS stylesheet for the dark theme, re-scoped to .streamd-dark .streamd-root. */
const darkCss = renderThemeStylesheet(darkTheme).replace(
  /\.streamd-root/g,
  ".streamd-dark .streamd-root",
);

/** @type {string} Complete HTML page template with inlined styles, bundles, and streaming replay script. */
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>@streamd/html demo</title>
<style>
  body { margin: 0; font-family: -apple-system, sans-serif; }
  .demo-shell { max-width: 920px; margin: 0 auto; padding: 24px; }
  .controls { display: flex; gap: 12px; align-items: center; padding: 16px 0; }
  button { padding: 8px 14px; border: 1px solid #ccc; border-radius: 6px; background: #f6f8fa; cursor: pointer; }
  button.active { background: #1f6feb; color: white; border-color: #1f6feb; }
  .streamd-dark { background: #0d1117; color: #e6edf3; }
  .streamd-dark button { background: #30363d; color: #e6edf3; border-color: #30363d; }
  .code-override { position: relative; margin: 1em 0; }
  .lang-badge { position: absolute; top: 4px; right: 8px; font-size: 11px; color: #666; background: #eee; padding: 2px 6px; border-radius: 3px; }
  .recipe-box { background: #f0f4f8; border: 1px solid #d0d7de; border-radius: 8px; padding: 16px; margin: 1em 0; }
  .recipe-box h3 { margin-top: 0; }
${lightCss}
${darkCss}
</style>
</head>
<body>
<div class="demo-shell">
  <h1 style="margin:0">@streamd/html demo</h1>
  <p>Pre-rendered output from the sample markdown, plus a streaming replay.</p>
  <div class="controls">
    <button id="btn-light" class="active">Light</button>
    <button id="btn-dark">Dark</button>
    <button id="btn-stream">Replay as stream</button>
    <label><input id="cb-class-prefix" type="checkbox" /> wrapRoot</label>
  </div>
  <div id="outer" class="streamd-light">
    <div id="pre-rendered">${preRendered}</div>
  </div>
  <h2>Component override: custom code block</h2>
  <p>The same markdown rendered with a <code>components.code_block</code> override
  that adds a language badge and reads <code>meta.highlight</code> for styled spans.</p>
  <div id="override-rendered" class="streamd-light">${overrideRendered}</div>
  <h2>KaTeX via component override</h2>
  <p>With <code>plugin-katex</code> removed, math rendering is a component-layer concern.
  Override <code>components.math_block</code> / <code>components.math_inline</code>:</p>
  ${katexRecipeHtml}
  <h2>Source</h2>
  <pre id="src" style="background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto">${escapeHtml(sampleMd)}</pre>
</div>

<script type="module">
  ${parserBundle}
  ${htmlBundle}

  const outer = document.getElementById("outer");
  const area = document.getElementById("pre-rendered");
  const source = ${JSON.stringify(sampleMd)};

  document.getElementById("btn-light").onclick = (e) => {
    outer.className = "streamd-light";
    document.getElementById("btn-light").classList.add("active");
    document.getElementById("btn-dark").classList.remove("active");
  };
  document.getElementById("btn-dark").onclick = (e) => {
    outer.className = "streamd-dark";
    document.getElementById("btn-dark").classList.add("active");
    document.getElementById("btn-light").classList.remove("active");
  };

  document.getElementById("btn-stream").onclick = async () => {
    area.innerHTML = "";
    let acc = "";
    let state = null;
    for (const ch of source) {
      acc += ch;
      const r = parse(acc, state, { gfm: true });
      state = r.state;
      area.innerHTML = renderHtml(r.tokens, { classPrefix: "streamd" });
      await new Promise(r => setTimeout(r, 8));
    }
  };
</script>
</body>
</html>
`;

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, page);
console.log(`wrote ${outPath} (${(page.length / 1024).toFixed(1)} KB)`);

/**
 * Escape characters that break raw HTML interpolation in a `<pre>` block:
 * ampersand, less-than, greater-than.
 *
 * @param {string} s Raw string to escape.
 * @returns {string} HTML-safe string with `&`, `<`, `>` replaced by entities.
 */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
