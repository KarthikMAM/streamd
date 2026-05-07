#!/usr/bin/env node
/**
 * Static file server for apps/html-demo. Serves dist/ on localhost:4321.
 *
 * Errors other than "file not found" (ENOENT) are logged to stderr so
 * a broken static bundle shows up in the terminal rather than silently
 * returning 404 for every request.
 *
 * @module apps/html-demo/serve
 */
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {number} Port to listen on, configurable via PORT env var for CI/container use. */
const port = Number(process.env.PORT ?? 4321);

/** @type {string} Absolute path to the dist/ directory containing built static assets. */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "dist");

/** @type {Record<string, string>} Extension-to-MIME mapping for common static asset types. */
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
};

/**
 * Handle an incoming HTTP request by serving the matching static file from dist/.
 *
 * Maps "/" to "/index.html". Rejects any path that resolves outside `root`
 * (defence-in-depth against `..` path-traversal). Returns 404 for missing
 * files and logs non-ENOENT errors to stderr for debugging broken bundles.
 *
 * @param {import("node:http").IncomingMessage} req Incoming HTTP request.
 * @param {import("node:http").ServerResponse} res Server response object.
 * @returns {Promise<void>}
 */
async function handleRequest(req, res) {
  const rawPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];

  // Strict allowlist — only serve paths matching `/[a-z0-9_-][a-z0-9/_.-]*`
  // ending in a known static-asset extension. Any deviation (traversal
  // segments, backslashes, null bytes, non-ASCII) is rejected before the
  // path ever reaches the filesystem API. CodeQL recognises the regex
  // allowlist as a sanitiser for its `js/path-injection` rule.
  const safePath = /^\/[a-zA-Z0-9_][a-zA-Z0-9/_.-]*$/.test(rawPath) ? rawPath : null;
  const ext = safePath ? extname(safePath) : "";
  const contentType = MIME[ext];

  if (safePath === null || contentType === undefined || safePath.includes("..")) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  const target = resolve(root, `.${safePath}`);
  const withinRoot = target === root || target.startsWith(`${root}/`);

  if (!withinRoot) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  try {
    const data = await readFile(target);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    const isNotFound = error?.code === "ENOENT";

    if (!isNotFound) {
      console.error("serve error", { path: safePath, error });
    }
    res.writeHead(404);
    res.end("not found");
  }
}

createServer(handleRequest).listen(port, () => console.log(`html-demo: http://localhost:${port}`));
