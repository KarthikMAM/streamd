---
"@streamd/cli": minor
---

**Breaking:** `--allow-dangerous-meta-html` flag removed.

The flag is no longer recognized by the CLI. Passing it now throws
`StreamdCliArgumentError { kind: "unknown-flag" }`. This aligns with
the LC-parity refactor (ADR 0004) which eliminates `meta.html` from
the token pipeline entirely.

Math rendering and syntax highlighting are now consumer choices via
component overrides in the library API. The CLI emits default HTML
only.
