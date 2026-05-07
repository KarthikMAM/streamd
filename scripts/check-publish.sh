#!/usr/bin/env bash
# Publish-readiness check — runs publint + arethetypeswrong on each
# published package. Catches broken exports/types/files metadata that
# would otherwise only surface on npm publish.
#
# Usage:
#   ./scripts/check-publish.sh

set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PACKAGES=(parser tokens html plugins react react-native plugin-shiki plugin-katex cli)
# Pure-ESM packages ignore the cjs-resolves-to-esm rule (they have no CJS entry by design).
ESM_ONLY=(cli)
FAILURES=0

is_esm_only() {
  local target="$1"
  for p in "${ESM_ONLY[@]}"; do
    if [[ "$p" == "$target" ]]; then return 0; fi
  done
  return 1
}

for pkg in "${PACKAGES[@]}"; do
  echo "=== publint @streamd/${pkg} ==="
  if ! (cd "packages/${pkg}" && npx publint --strict); then
    FAILURES=$((FAILURES + 1))
  fi
done

for pkg in "${PACKAGES[@]}"; do
  echo
  echo "=== arethetypeswrong @streamd/${pkg} ==="
  attw_flags=(--pack "." --profile node16)
  if is_esm_only "$pkg"; then
    attw_flags+=(--ignore-rules cjs-resolves-to-esm)
  fi
  (
    cd "packages/${pkg}"
    tarball=$(npm pack --silent | tail -1)
    trap 'rm -f "$tarball"' EXIT
    if ! npx attw "${attw_flags[@]}"; then
      FAILURES=$((FAILURES + 1))
    fi
  )
done

if [[ $FAILURES -gt 0 ]]; then
  echo
  echo "check-publish: ${FAILURES} package(s) failed"
  exit 1
fi
echo
echo "check-publish: clean"
