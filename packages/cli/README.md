# @streamd/cli

Command-line front end for the streamd toolchain. Pipes markdown
through [`@streamd/parser`](../parser) + [`@streamd/html`](../html) +
[`@streamd/plugins`](../plugins) and writes HTML to stdout — with
first-class support for the streaming LLM use case.

## Install

```bash
npm install -g @streamd/cli
```

Or run without installing:

```bash
npx @streamd/cli --gfm < README.md
```

## Usage

### One-shot: pipe markdown through

```bash
echo '# hello **world**' | streamd
# => <h1>hello <strong>world</strong></h1>
```

### LLM streaming output

```bash
llm chat --stream < prompt.txt | streamd --gfm --stream delta
```

`--stream delta` writes the common-prefix additive slice on every
stdin chunk — ideal for a consumer that maintains a DOM buffer and
replaces the tail on each delta.

### File in, file out

```bash
streamd --theme dark --class-prefix md --wrap-root < input.md > output.html
```

### Compose with other Unix tools

```bash
curl -s https://example.test/article.md | streamd --gfm --anchors --link-attrs > article.html
```

## Flag reference

| Flag | Default | Purpose |
|---|---|---|
| `--gfm` / `--no-gfm` | off | Enable GFM extensions (tables, strike, task lists, autolinks) |
| `--math` | off | Enable `$...$` inline and `$$...$$` block math |
| `--class-prefix <str>` | — | Add `class="<prefix>-<kind>"` to every block tag |
| `--theme <light\|dark\|none>` | `none` | Prepend a `<style>` block with CSS vars + theme rules |
| `--anchors` | off | Inject stable heading `id` attributes via `headingAnchors()` |
| `--link-attrs` | off | Inject `rel`/`target` on external links via `linkAttributes()` |
| `--sanitize` / `--no-sanitize` | on | Apply the default-strict `sanitize()` plugin |
| `--stream <auto\|delta\|full\|off>` | `auto` | Streaming mode. `auto` picks delta for pipes, off for a TTY |
| `--wrap-root` | off | Wrap output in `<div class="<prefix>-root">`. Requires `--class-prefix` |
| `--xhtml` / `--no-xhtml` | on | XHTML-style void tags (`<br />` vs `<br>`) |
| `-v`, `--version` | — | Print version and exit |
| `-h`, `--help` | — | Print help and exit |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Runtime error during parse / render / write |
| `2` | Argument error (unknown flag, bad value, conflicting flags) |
| `130` | Interrupted (SIGINT) |
| `143` | Terminated (SIGTERM) |

## Streaming modes

- **`auto`** (default) — delta for pipes, off for interactive TTYs.
  Picks the behaviour users usually want without extra flags.
- **`delta`** — on each stdin chunk, emit `html.slice(commonPrefix(prev, new))`.
  The consumer is expected to replace the tail from the common-prefix
  boundary when structure changes; plain append works when the markdown
  grows monotonically.
- **`full`** — render the entire HTML on every chunk. Useful when the
  consumer processes writes individually (testing, chunked transport),
  less useful for plain stdout.
- **`off`** — drain stdin to EOF, render once, write once.

## Security

`--sanitize` is **on by default** and applies the strict
`@streamd/plugins` sanitizer:

- `Link.href` / `Image.src` schemes are restricted to `http:`,
  `https:`, `mailto:`, `tel:`, `ftp:`.
- `meta.attrs` keys are filtered to a safe allowlist.

Pass `--no-sanitize` **only** for trusted input — unsafe URLs will not
be rewritten and any `meta.attrs` plugins attached will reach the
renderer unfiltered.

## Math / syntax highlighting

Math rendering and syntax highlighting are consumer choices in the
library API. The CLI emits default HTML only — `code_block` tokens
render as plain `<pre><code>` and `math_block` / `math_inline` tokens
render as `<code>` with the raw TeX content. Consumers that need
KaTeX or Shiki output should use the library API with component
overrides.

## Programmatic API

The same pipeline is exposed programmatically so tests and downstream
tools can drive it without spawning a child process:

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

Additional exports: `parseCliArgs`, `buildStreamOptions`,
`runStreaming`, `runNonStreaming`, `computeDelta`, `commonPrefixLen`,
`StreamdCliArgumentError`.

## Pairing

- Parser: [`@streamd/parser`](../parser)
- HTML renderer: [`@streamd/html`](../html)
- Plugin pipeline: [`@streamd/plugins`](../plugins) (+ optional
  adapter [`@streamd/plugin-shiki`](../plugin-shiki))
- Monorepo overview: [`streamd README`](../../README.md)

## License

MIT.
