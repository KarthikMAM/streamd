# Architecture Decision Records

A chronological record of non-trivial decisions — especially ones that
deviate from the steering rules or commit to an API contract.

| #    | Title                                                                                    | Status   |
|------|------------------------------------------------------------------------------------------|----------|
| 0001 | [Parser performance exceptions](./0001-parser-performance-exceptions.md)                 | Accepted |
| 0002 | [Streaming contract — stableCount + prefix immutability](./0002-streaming-contract.md)   | Accepted |
| 0003 | [Performance baseline governance](./0003-performance-baseline-governance.md)             | Accepted |

## Writing a new ADR

1. Copy [`TEMPLATE.md`](./TEMPLATE.md) to `NNNN-<slug>.md` where `NNNN` is
   the next number.
2. Fill in the sections. Keep each ADR under 100 lines — if it's
   longer, split it.
3. Link the new row into this index.
4. Reference the ADR from the code it describes (file header comment or
   steering rule).
