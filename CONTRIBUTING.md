# Contributing to streamd

Thanks for the interest. This repo is a TypeScript monorepo managed with
`turbo`, `npm` workspaces, and `biome`.

## Before you start

1. Read [`STYLE.md`](STYLE.md) — every rule there is auto-enforced, so
   a change that violates them won't even pass pre-commit.
2. Read the design doc in
   [`.kiro/steering/parser-design.md`](.kiro/steering/parser-design.md)
   if you're touching `@streamd/parser`. It captures the streaming
   invariants and performance exceptions the parser depends on.
3. Skim `README.md` for the high-level layout.

## Workflow

```bash
git clone https://github.com/KarthikMAM/streamd.git
cd streamd
npm install
npm run ci          # baseline — should be green before you start
```

Make your change, then:

```bash
npm run lint:fix    # auto-format + apply biome autofixes
npm run check:banned
npm run typecheck
npm run test
```

Use `npx changeset` to add a changeset describing your change. CI uses
the changeset to decide package version bumps.

## Commit messages

Commits follow [Conventional
Commits](https://www.conventionalcommits.org/) via `commitlint`. Format:

```
<type>(<scope>): <subject>
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`,
`perf`, `style`, `build`, `ci`.

Subject is lowercase, imperative, no trailing period, max 72 chars.

## Opening a PR

- PR title follows the same Conventional Commit format.
- Fill out the PR template — every checkbox is a gate.
- CI must be green. If a check is flaky, fix the root cause; don't
  rerun until it passes.
- Include `a changeset` (via `npx changeset`) for any user-facing
  change.

## Testing rules (from steering §14)

- Test names describe scenario and outcome, not the method under test:
  `test_fetchUser_withExpiredToken_throwsUnauthorized`.
- One logical assertion per test.
- No network / file I/O in unit tests — mock at the boundary.
- No shared mutable fixtures.
- Flaky tests are bugs. Fix the root cause.

## Performance exceptions

Some steering rules are relaxed in documented hot-path files (parser
internals, renderer walk loops). Do not expand the override list
without a measured justification; see the second override in
[`biome.json`](biome.json) and the per-file `@module` docstrings that
explain why each exception exists.

## Reviewing a PR

- Confirm CI is green.
- Confirm the changeset matches the change's impact.
- Read [STYLE.md](./STYLE.md) once per review — it maps each steering rule
  to its mechanical enforcement, and the `Code-Quality Self-Review` block in
  the PR template summarises what reviewers gate on.

## Releasing

Maintainers only. The `Release` workflow publishes tags and packages
when a changeset PR is merged to `main`.
