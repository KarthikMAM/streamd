# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) to
manage versioning and changelogs for the six published packages.

## Why

- The six published packages (`@streamd/parser`, `@streamd/tokens`,
  `@streamd/html`, `@streamd/react`, `@streamd/react-native`,
  `@streamd/plugins`) are **version-linked**: any change to one that
  affects the public API bumps all six together. This prevents a
  consumer from winding up with, say, `@streamd/parser@0.5` and
  `@streamd/html@0.4` that disagree on the token shape.
- The internal packages (`bench`, `spec`, `e2e`, `config`) are on
  the `ignore` list — they never publish.

## Authoring a changeset

Before opening a PR that touches a public package, run:

```bash
npx changeset
```

Pick the affected packages, pick the bump level (patch / minor / major),
and write a one-line summary. The resulting `.changeset/*.md` file
commits alongside your code change.

### Bump-level guide

| Bump    | When                                                                                          |
|---------|-----------------------------------------------------------------------------------------------|
| `patch` | Bug fix, internal refactor, dep update, doc fix.                                              |
| `minor` | New additive API, new token type, new plugin. Deprecate-but-don't-remove.                     |
| `major` | Breaking change. Public type renamed, option removed, token shape changed. Needs migration.   |

For pre-1.0 packages a `minor` bump is effectively a breaking change —
match our policy (in `CONTRIBUTING.md`) to the target consumer.

## Release flow

1. Merge PRs with changesets into `main`.
2. The `Release` workflow opens a **Release PR** aggregating all pending
   changesets into version bumps + CHANGELOG entries.
3. Merging the Release PR publishes to npm via `npm publish --provenance`.

The release workflow lives at `.github/workflows/release.yml` and runs
the full gate (`lint → banned → build → typecheck → test`) before it
publishes. A broken gate blocks the release.
