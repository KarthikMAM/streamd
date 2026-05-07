---
title: "@streamd/cli"
sidebar_position: 9
---

# @streamd/cli

Command-line front end for the streamd toolchain. Pipes markdown
through [`@streamd/parser`](./parser) + [`@streamd/html`](./html) +
[`@streamd/plugins`](./plugins) and writes HTML to stdout — with
first-class support for the streaming LLM use case.

Who it's for: terminal workflows, shell pipelines, CI steps, and any
tool that wants to invoke streamd without importing the library.

## Install

```bash
npm install -g @streamd/cli
```

Or run without installing:

```bash
npx @streamd/cli --gfm < README.md
```

## Quick start

### One-shot: pipe markdown through

```bash
echo '# hello **world**' | streamd
# <h1>hello <strong>world</strong></h1>
```

### LLM streaming output

```bash
llm chat --stream < prompt.txt | streamd --gfm --stream delta
```

`--stream delta` emits the common-prefix additive slice on every
stdin chunk — ideal for a consumer that maintains a DOM buffer and
replaces the tail on each delta.

### File in, file out

```bash
streamd --theme dark --class-prefix md --wrap-root < input.md > output.html
```

## Key APIs

The same pipeline is exposed programmatically so tests and downstream
tools can drive it without spawning a child process.

```ts
import { run } from "@streamd/cli";
import { Readable, PassThrough } from "node:stream";

const stdout = new PassThrough();
const code = await run(["--gfm"], {
  stdin: Readable.from("~~gone~~\n"),
  stdout,
  stderr: process.stderr,
});
// code === 0, stdout contains "<p><del>gone</del></p>\n"
```

| Export | Purpose |
|---|---|
| `run(argv, streams)` | Drive the whole pipeline. Returns the exit code. |
| `parseCliArgs(argv)` | Parse flags into a `CliOptions` record. |
| `buildStreamOptions`, `buildParseOptions`, `buildPlugins`, `buildThemeStyleBlock` | Reusable composition helpers for downstream tools. |
| `runStreaming`, `runNonStreaming` | Lower-level entry points. |
| `resolveStreamMode` | Pick a concrete mode from `"auto"`. |
| `computeDelta`, `commonPrefixLen` | Delta-mode primitives. |
| `readAllStdin` | Async stdin drain. |
| `assertArgv`, `StreamdCliArgumentError` | Input validation plus the matching `TypeError` subclass. |
| `CLI_VERSION`, `HELP_TEXT` | The CLI's advertised version and help output. |
| Types | `CliOptions`, `CliStreamMode`, `CliTheme`, `RunStreams`, `StreamdCliArgumentErrorFields`, `StreamdCliArgumentErrorKind`. |

## Flag reference

| Flag | Default | Purpose |
|---|---|---|
| `--gfm` / `--no-gfm` | off | Enable GFM (tables, strike, task lists, autolinks). |
| `--math` | off | Enable `$…$` inline and `$$…$$` block math. |
| `--class-prefix <str>` | — | Add `class="<prefix>-<kind>"` to every block tag. |
| `--theme <light\|dark\|none>` | `none` | Prepend a `<style>` block with CSS vars + theme rules. |
| `--anchors` | off | Inject stable heading `id` attributes via `headingAnchors()`. |
| `--link-attrs` | off | Inject `rel` / `target` on external links via `linkAttributes()`. |
| `--sanitize` / `--no-sanitize` | on | Apply the default-strict `sanitize()` plugin. |
| `--allow-dangerous-meta-html` | off | Honour plugin-attached `meta.html` (requires trusted plugins). |
| `--stream <auto\|delta\|full\|off>` | `auto` | Streaming mode. `auto` picks delta for pipes, off for a TTY. |
| `--wrap-root` | off | Wrap output in `<div class="<prefix>-root">`. Requires `--class-prefix`. |
| `--xhtml` / `--no-xhtml` | on | XHTML-style void tags (`<br />` vs `<br>`). |
| `-v`, `--version` | — | Print version and exit. |
| `-h`, `--help` | — | Print help and exit. |

## Streaming modes

- **`auto`** (default) — `delta` for pipes, `off` for interactive
  TTYs. Picks the behaviour users usually want without extra flags.
- **`delta`** — on each stdin chunk, emit
  `html.slice(commonPrefix(prev, new))`. The consumer is expected to
  replace the tail from the common-prefix boundary when structure
  changes; plain append works when the markdown grows monotonically.
- **`full`** — render the entire HTML on every chunk. Useful when
  the consumer processes writes individually (testing, chunked
  transport), less useful for plain stdout.
- **`off`** — drain stdin to EOF, render once, write once.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success. |
| `1` | Runtime error during parse / render / write. |
| `2` | Argument error (unknown flag, bad value, conflicting flags). |
| `130` | Interrupted (SIGINT). |
| `143` | Terminated (SIGTERM). |

## Security notes

`--sanitize` is **on by default** and applies the strict
`@streamd/plugins` sanitizer:

- `HtmlBlock` / `HtmlInline` tokens are dropped.
- `Link.href` / `Image.src` schemes are restricted to `http:`,
  `https:`, `mailto:`, `tel:`, `ftp:`.
- `meta.html` (pre-rendered HTML plugins may attach) is stripped.
- `meta.attrs` keys are filtered to a safe allowlist.

Pass `--allow-dangerous-meta-html` **only** when every plugin in the
pipeline is trusted to emit well-formed HTML (e.g. a vetted Shiki
syntax highlighter). The flag loosens the renderer's `meta.html`
passthrough and, when combined with `--sanitize`, tells the
sanitizer to let `meta.html` survive.

Pass `--no-sanitize` **only** for trusted input — raw HTML tokens
will be emitted verbatim, `javascript:` URLs will not be rewritten,
and any `meta.html` any plugin attached will reach the renderer
unfiltered.

## Source

- [README on GitHub](https://github.com/KarthikMAM/streamd/blob/main/packages/cli/README.md)
- [Source tree](https://github.com/KarthikMAM/streamd/tree/main/packages/cli/src)
