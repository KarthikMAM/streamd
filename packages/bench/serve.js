/**
 * Minimal static file server with cross-origin isolation headers.
 *
 * These headers enable high-resolution performance.now() in Chrome
 * (5µs instead of 100µs), which is critical for accurate benchmarks.
 *
 * Usage: node serve.js
 */
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 3000;
const ROOT = fileURLToPath(new URL(".", import.meta.url));

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".md": "text/markdown",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = join(ROOT, path);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Benchmark server: http://localhost:${PORT} (cross-origin isolated)`);
});
