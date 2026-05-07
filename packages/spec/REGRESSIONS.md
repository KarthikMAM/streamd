# @streamd/spec — Regressions & Skip Maintenance

Operator guide for the CommonMark + GFM conformance tooling. Read this
when:

- A spec fixture that used to pass starts failing.
- A spec fixture that used to be in the skip list starts passing.
- You've changed the parser or renderer and want to refresh the skip
  list to reflect the new reality.

For the code-level design, see `parser-design.md` (steering doc). For
the annotated skip data itself, see `src/skip.ts`.

---

## 1 — Tooling layout

| File | Role |
|---|---|
| `src/skip.ts` | Source of truth for which fixtures are expected to diverge. Exports `SKIP_METADATA` (annotated, per-cluster) and a derived flat `SKIP` runtime view. |
| `src/spec.test.ts` | Vitest runner. Reads `SKIP` and dispatches `.skip` on matching fixtures. |
| `scripts/collect-failures.mjs` | Runs every fixture through parser + renderer, groups failures by cluster, and regenerates `skip.ts`. Supports `--write` and `--annotate`. |
| `scripts/sync.mjs` | (Existing.) Pulls fresh spec fixtures from upstream — unrelated to this workflow. |
| `../../scripts/check-spec-regression.mjs` | CI regression guard. Compares current pass/fail state to `baseline.json` and fails on regressions. |
| `baseline.json` | Committed snapshot of per-test pass / skip state. Regenerated via `check-spec-regression.mjs --write`. |

---

## 2 — Regenerating the skip list

### 2.1 Common workflow (parser / renderer change, no classification edits)

```bash
# Run from repo root.
node packages/spec/scripts/collect-failures.mjs --annotate --write

# Biome-format the regenerated file so it lints clean.
BIOME_BINARY=@biomejs/cli-linux-x64-musl/biome npx biome format --write packages/spec/src/skip.ts

# Verify the test runner picks up the new skip list.
(cd packages/spec && npx vitest run)
```

`--annotate` preserves existing cluster-level annotations
(`classification`, `notes`, `docLinkInParserDesign`, `trackingUrl`)
for clusters that still exist; brand-new clusters land with
`classification: "under-investigation"` and a placeholder note, and
clusters where every fixture now passes are dropped entirely.

### 2.2 Dry run

Omit `--write` to see the pass-rate summary without touching
`skip.ts`:

```bash
node packages/spec/scripts/collect-failures.mjs
# → CommonMark: 491 / 655 pass
#   GFM:        512 / 733 pass
#   Failures:   164 (CM) + 221 (GFM)
#   Dry run — pass --write to overwrite skip.ts.
```

### 2.3 Fresh generation (discard existing annotations)

If the existing annotations are stale enough that starting from scratch
is easier than editing in place, drop `--annotate`:

```bash
node packages/spec/scripts/collect-failures.mjs --write
```

Every cluster will be re-annotated with the `under-investigation`
default. Be prepared to re-classify by hand.

---

## 3 — Classification guide

Every cluster in `SKIP_METADATA` carries a `classification` field from
the following closed set. Use these definitions when triaging:

### 3.1 `documented-limitation`

The divergence is an accepted architectural trade-off and there is a
matching entry in `parser-design.md` §11 Known Limitations. The
cluster must set `docLinkInParserDesign` to the §11 sub-entry. Example:

```ts
"block-quotes": {
  annotation: {
    classification: "documented-limitation",
    notes: "Blockquote lazy continuation is approximate — …",
    docLinkInParserDesign: "parser-design.md §11 \"Blockquote lazy continuation\"",
  },
  examples: [...],
}
```

Do not label a cluster `documented-limitation` without a `§11` entry
that describes the same behaviour. If the §11 entry is missing, either
add it or relabel the cluster.

### 3.2 `fixable`

The divergence is a bug we intend to fix but haven't yet. There is no
architectural reason it exists. Implies an upcoming change to the
parser or renderer. Use `notes` to record the sketch of the intended
fix — future-you will thank you.

### 3.3 `known-bug`

The divergence is a bug that contradicts a statement made elsewhere in
`parser-design.md` (typically a `§3`/`§4`/`§5` design claim). Must
carry a `trackingUrl` so the ticket closing the bug can reference the
same source of truth.

### 3.4 `under-investigation`

Root cause not yet diagnosed. This is the default for new clusters
coming out of `collect-failures.mjs` and for older clusters waiting on
triage. Aim to reduce the count of `under-investigation` clusters over
time by promoting each to one of the three classifications above.

---

## 4 — When a skip flips from failing to passing

Celebratory path. The parser improved; a fixture that used to diverge
now matches the reference.

1. `scripts/check-spec-regression.mjs` will emit a celebratory warning:

   ```
   [WARN] commonmark 0.31.2 / 0082--setext-headings: was skipped in
          baseline, now passing. Consider removing from skip.ts.
   ```

2. Regenerate `skip.ts`:

   ```bash
   node packages/spec/scripts/collect-failures.mjs --annotate --write
   BIOME_BINARY=@biomejs/cli-linux-x64-musl/biome npx biome format --write packages/spec/src/skip.ts
   ```

   The passing fixture drops out of its cluster; if the cluster empties
   entirely, the whole cluster block is removed.

3. Refresh the baseline:

   ```bash
   node scripts/check-spec-regression.mjs --write
   ```

4. Update the module-level pass-rate snapshot in `skip.ts` (the script
   already regenerates it, but double-check the numbers).

5. Bump the `README.md` pass-rate line if the move is material.

6. Commit `skip.ts` + `baseline.json` together.

---

## 5 — When a passing test starts failing

Regression path. This is the one that breaks CI.

1. `scripts/check-spec-regression.mjs` will fail with:

   ```
   [FAIL] commonmark 0.31.2 / 0003--tabs: was passing in baseline,
          now failing. Fix or classify.
   ```

2. Fix the root cause in the parser or renderer. The goal is to get
   back to baseline; do not reach for `skip.ts` first.

3. If the regression is genuinely un-fixable in the short term,
   classify it: add it to an existing cluster in `skip.ts`, or create
   a new cluster. Choose the classification per §3 of this doc. If you
   create a new cluster, add a matching entry to `parser-design.md`
   §11 (for `documented-limitation`) or file a tracking ticket (for
   `known-bug`).

4. Refresh the baseline and commit.

---

## 6 — When a skip becomes a hard failure

Substitution regression. A fixture that used to be in the skip list is
now producing a _different_ kind of failure — for example, someone
removed it from `skip.ts` thinking it would pass, but the parser still
diverges.

`scripts/check-spec-regression.mjs` will fail with:

```
[FAIL] gfm 0.29 / 0232--list-items: was skipped in baseline, now
       failing (expected to pass after removal from skip list).
```

Two possible responses:

1. The removal was premature. Put it back into its cluster in
   `skip.ts` and regenerate the baseline.
2. The expectation was correct but the parser regressed. Fix the
   parser per §5 above.

Never "fix" this by silently deleting the test or the skip entry — the
baseline exists precisely to catch this class of silent regression.

---

## 7 — When the fixture count changes

If you re-sync upstream fixtures via `scripts/sync.mjs`, the total
count can shift. `scripts/check-spec-regression.mjs` flags this as:

```
[FAIL] commonmark 0.31.2: total test count dropped (1388 → 1386).
```

If the drop is expected (e.g. upstream removed a fixture), regenerate
the baseline:

```bash
node scripts/check-spec-regression.mjs --write
```

Otherwise it's a genuine "someone silently dropped a test file"
incident — investigate before refreshing the baseline.

---

## 8 — Minimal mental model

- `skip.ts` is the source of truth for what the parser can't do yet.
- `baseline.json` is the source of truth for what the **state** was
  last time we checked.
- `collect-failures.mjs` regenerates `skip.ts` from reality.
- `check-spec-regression.mjs` compares reality to `baseline.json`.
- Every skipped cluster has a classification so reviewers can tell
  "this is a trade-off" from "this is a bug we owe" at a glance.
