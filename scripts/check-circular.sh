#!/usr/bin/env bash
# Dependency graph integrity — fail if madge finds any circular import
# inside the published source tree. Keeping the graph acyclic is
# essential for tree-shaking and predictable load order.

set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS_CONFIG=node_modules/@streamd/config/tsconfig.base.json
if [[ ! -f "$TS_CONFIG" ]]; then
  TS_CONFIG=packages/config/tsconfig.base.json
fi

PACKAGES=(parser tokens html plugins react react-native)

FAILURES=0
for pkg in "${PACKAGES[@]}"; do
  echo "=== madge @streamd/${pkg} ==="
  if ! npx madge \
    --circular \
    --extensions ts,tsx \
    --ts-config "packages/${pkg}/tsconfig.json" \
    "packages/${pkg}/src"; then
    echo "[FAIL] Circular dependency in @streamd/${pkg}"
    FAILURES=$((FAILURES + 1))
  fi
done

if [[ $FAILURES -gt 0 ]]; then
  echo "check-circular: ${FAILURES} package(s) contain circular imports"
  exit 1
fi
echo "check-circular: clean"
