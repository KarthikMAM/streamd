# @streamd/spec

Internal — not published. CommonMark 0.31.2 + GFM 0.29 conformance
suite for [`@streamd/parser`](../parser) + [`@streamd/html`](../html).

## Status

The suite runs every CommonMark and GFM spec example in a single pass
and gates the build against a regression baseline. Every currently
diverging example is pinned in [`src/skip.ts`](src/skip.ts); anything
outside that list must pass, and any new skip requires a paired entry
in that file so a reviewer can see exactly what was accepted. There are
no pass-by-construction tests — flipping `.toBe()` to `.not.toBe()` to
hide divergences is explicitly forbidden.

## Update fixtures

```bash
npm run sync   # pulls upstream spec.txt files from commonmark-spec + cmark-gfm
```

## Run

```bash
npm run test
```

## Regenerating the skip list

After a parser / renderer change, regenerate `src/skip.ts` so it
reflects the new divergences:

```bash
# From the repo root:
node packages/spec/scripts/collect-failures.mjs --annotate --write
BIOME_BINARY=@biomejs/cli-linux-x64-musl/biome npx biome format --write packages/spec/src/skip.ts
```

See [`REGRESSIONS.md`](REGRESSIONS.md) for the full workflow —
classification guide, the regression-guard contract, and what to do
when a skip flips.
