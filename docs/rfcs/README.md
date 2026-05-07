# RFCs — Request for Comments

An RFC is the author-proposed, reviewer-refined design doc for any
**breaking change** or **cross-package addition**. An ADR records what
the project decided; an RFC is the proposal that led there.

## When to write an RFC

You should open an RFC before writing code if your change:

- Alters a signature of a public function or type.
- Removes a feature.
- Adds a new token type to the parser.
- Adds a new built-in plugin.
- Changes the streaming contract (`stableCount`, token stability).

You can skip the RFC for:

- Bug fixes that preserve the public API.
- Performance-only internal refactors.
- New internal utility files.

## Process

1. Copy [`TEMPLATE.md`](./TEMPLATE.md) to `NNNN-<slug>.md`.
2. Open a PR titled `rfc: <slug>` that adds only the RFC file. Do
   **not** include implementation code yet.
3. Request review from at least one maintainer per affected package
   (see `.github/CODEOWNERS`).
4. Converge on a decision. On acceptance: move the status to
   "Accepted", merge the RFC, open a follow-up ADR if the decision
   deserves a standalone record, and start implementation.
5. On rejection: update the status to "Rejected" with a short
   resolution note and merge anyway. Rejected RFCs are history too.

## Active RFCs

_None yet._

## Accepted / Rejected RFCs

_None yet._
