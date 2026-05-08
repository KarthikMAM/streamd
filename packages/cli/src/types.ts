/**
 * Public types for @streamd/cli.
 *
 * Every value the CLI reads from `argv` or the environment ends up in
 * one of the interfaces defined here. Keeping them in a single file
 * makes the public surface auditable at a glance.
 *
 * @module types
 */

import type { Readable, Writable } from "node:stream";

/** Theme stylesheet injected as a `<style>` block before the rendered HTML. */
export type CliTheme = "light" | "dark" | "none";

/**
 * Streaming mode for stdin → stdout.
 *
 * - `"auto"` — pick based on stdin isTTY: pipe → `"delta"`, TTY → `"off"`.
 * - `"delta"` — emit the common-prefix delta between each re-render.
 * - `"full"` — emit the full rendered HTML on every chunk (debugging).
 * - `"off"` — read stdin to EOF, then render once.
 */
export type CliStreamMode = "auto" | "delta" | "full" | "off";

/**
 * Parsed and validated CLI options produced by `parseCliArgs()`.
 *
 * Every field is always present — `parseCliArgs` applies defaults up
 * front so downstream code never has to branch on `undefined`. Boolean
 * "off" means the feature is disabled, not "not specified".
 */
export interface CliOptions {
  /** Enable GFM extensions (tables, strike, task lists, autolinks). */
  readonly gfm: boolean;
  /** Enable math (`$...$` inline, `$$...$$` block). */
  readonly math: boolean;
  /** CSS class prefix on block tags. Empty string means "no classes". */
  readonly classPrefix: string;
  /** Theme stylesheet to prepend. `"none"` means no stylesheet. */
  readonly theme: CliTheme;
  /** Inject stable `id` attributes on heading tokens via the `headingAnchors()` plugin. */
  readonly anchors: boolean;
  /** Inject `rel`/`target` on external link tokens via the `linkAttributes()` plugin. */
  readonly linkAttrs: boolean;
  /** Apply the default-strict `sanitize()` plugin. Default: true. */
  readonly sanitize: boolean;
  /** Streaming mode. `"auto"` picks based on stdin.isTTY. */
  readonly stream: CliStreamMode;
  /** Wrap output in `<div class="${prefix}-root">`. Requires `classPrefix`. */
  readonly wrapRoot: boolean;
  /** Emit XHTML-style void tags (`<br />` vs `<br>`). Default: true. */
  readonly xhtml: boolean;
  /** True when `--help`/`-h` was present; caller prints help and exits 0. */
  readonly help: boolean;
  /** True when `--version`/`-v` was present; caller prints version and exits 0. */
  readonly version: boolean;
}

/**
 * Stream trio passed to `run()` so tests can substitute in-memory
 * buffers without spawning a child process.
 *
 * `stdin` must be a Node `Readable`. `stdout` / `stderr` must be
 * `Writable`s. A `Writable.write` return value is ignored — the CLI
 * does not backpressure.
 */
export interface RunStreams {
  readonly stdin: Readable;
  readonly stdout: Writable;
  readonly stderr: Writable;
}
