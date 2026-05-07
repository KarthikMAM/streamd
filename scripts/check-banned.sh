#!/usr/bin/env bash
# Enforce steering rules that Biome cannot express natively.
#
# Checks for:
#   1. @ts-ignore / @ts-nocheck / @ts-expect-error directives outside tests
#   2. Banned identifier names (Helper, Utils, Service, Handler, Manager, etc.)
#      used as the first component of a type or class name
#   3. TODO/FIXME/HACK/WORKAROUND comments without a linked ticket ID
#
# Exits with code 1 on any finding, 0 otherwise.
#
# Usage:
#   ./scripts/check-banned.sh [path...]
# Paths default to the tracked sources in packages/ and apps/.

set -euo pipefail
IFS=$'\n\t'

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ $# -gt 0 ]]; then
  FILES=("$@")
else
  mapfile -t FILES < <(
    git ls-files \
      'packages/*.ts' 'packages/*.tsx' 'packages/**/*.ts' 'packages/**/*.tsx' \
      'apps/*.ts' 'apps/*.tsx' 'apps/**/*.ts' 'apps/**/*.tsx' \
      ':!packages/parser/**' \
      ':!**/__tests__/**' \
      ':!**/*.test.ts' \
      ':!**/*.test.tsx' \
      ':!**/node_modules/**' \
      ':!**/dist/**' 2>/dev/null || true
  )
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "check-banned: no files to scan"
  exit 0
fi

FAILURES=0

check_directive() {
  local pattern="$1"
  local description="$2"
  local hits
  hits=$(grep -nE "${pattern}" "${FILES[@]}" 2>/dev/null || true)
  if [[ -n "$hits" ]]; then
    echo "[FAIL] ${description}:"
    echo "$hits"
    echo
    FAILURES=$((FAILURES + 1))
  fi
}

check_banned_type_name() {
  local pattern="$1"
  local description="$2"
  local hits
  hits=$(grep -nE "${pattern}" "${FILES[@]}" 2>/dev/null || true)
  if [[ -n "$hits" ]]; then
    echo "[FAIL] ${description}:"
    echo "$hits"
    echo
    FAILURES=$((FAILURES + 1))
  fi
}

check_todo_without_ticket() {
  local pattern='// (TODO|FIXME|HACK|WORKAROUND)(\b|:)'
  local hits
  # Collect TODO-class comments, then drop lines that reference a ticket-like token
  hits=$(
    grep -nE "${pattern}" "${FILES[@]}" 2>/dev/null \
      | grep -vE '(#[0-9]+|[A-Z]{2,}-[0-9]+|https?://)' \
      || true
  )
  if [[ -n "$hits" ]]; then
    echo "[FAIL] TODO/HACK/FIXME without linked ticket or URL:"
    echo "$hits"
    echo
    FAILURES=$((FAILURES + 1))
  fi
}

check_directive '(^|[^a-zA-Z])@ts-(ignore|nocheck|expect-error)' \
  "@ts-ignore / @ts-nocheck / @ts-expect-error directive found (fix the type, don't silence the checker)"

check_focused_tests() {
  local test_files
  mapfile -t test_files < <(
    git ls-files \
      'packages/*.test.ts' 'packages/*.test.tsx' \
      'packages/**/*.test.ts' 'packages/**/*.test.tsx' \
      ':!**/node_modules/**' 2>/dev/null || true
  )
  if [[ ${#test_files[@]} -eq 0 ]]; then return; fi
  local hits
  hits=$(
    grep -nE '(^|\s)(describe|it|test)\.only\b|\bfit\(|\bfdescribe\(' "${test_files[@]}" 2>/dev/null || true
  )
  if [[ -n "$hits" ]]; then
    echo "[FAIL] Focused test found (describe.only / it.only / fit / fdescribe) — remove before merging:"
    echo "$hits"
    echo
    FAILURES=$((FAILURES + 1))
  fi
}

check_focused_tests

# Banned type/class/interface names per steering §3.3.
check_banned_type_name \
  '^\s*(export\s+)?(abstract\s+)?(class|interface|type)\s+(Helper|Helpers|Util|Utils|Manager|Service|Handler|Processor|Wrapper|Base|Common|Misc)\b' \
  "Banned type/class/interface name (use the actual responsibility as the name)"

# Banned local names as declared identifiers
check_banned_type_name \
  '^\s*(const|let|var)\s+(tmp1|data2|obj|info)\b' \
  "Banned local variable name (tmp1/data2/obj/info)"

check_todo_without_ticket

check_secret_patterns() {
  # Obvious credential patterns that should never land in source.
  # Not a full secret scanner — just a fast guard against common slips.
  local patterns=(
    'AKIA[0-9A-Z]{16}'
    'ghp_[A-Za-z0-9]{36}'
    'gho_[A-Za-z0-9]{36}'
    'ghs_[A-Za-z0-9]{36}'
    '-----BEGIN (RSA|OPENSSH|PGP) PRIVATE KEY-----'
  )
  local hits
  for pattern in "${patterns[@]}"; do
    hits=$(grep -nE "${pattern}" "${FILES[@]}" 2>/dev/null || true)
    if [[ -n "$hits" ]]; then
      echo "[FAIL] Credential-shaped literal detected — rotate the secret and remove from source:"
      echo "$hits"
      echo
      FAILURES=$((FAILURES + 1))
    fi
  done
}

check_secret_patterns

if [[ $FAILURES -gt 0 ]]; then
  echo "check-banned: ${FAILURES} violation group(s) found"
  exit 1
fi
echo "check-banned: clean"
