#!/usr/bin/env bash
# Thin wrapper — delegates to check-spec-regression.mjs so legacy
# invocations (e.g. external CI config) keep working. All logic lives
# in the Node script.
#
# See scripts/check-spec-regression.mjs for the regression semantics
# and packages/spec/REGRESSIONS.md for the operator guide.

set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "${ROOT}/scripts/check-spec-regression.mjs" "$@"
