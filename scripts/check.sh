#!/usr/bin/env bash
# Run all CI checks locally inside Docker containers.
# Usage: ./scripts/check.sh
# Exit 0 only if every check passes.

set -euo pipefail

PASS="\033[32m✓\033[0m"
FAIL="\033[31m✗\033[0m"
BOLD="\033[1m"
RESET="\033[0m"

failures=()

run() {
  local label="$1"; shift
  printf "  %-35s" "$label"
  if output=$(docker compose exec "$@" 2>&1); then
    echo -e "$PASS"
  else
    echo -e "$FAIL"
    failures+=("$label")
    echo "$output" | sed 's/^/    /'
  fi
}

echo -e "\n${BOLD}Backend${RESET}"
run "build"     backend go build ./...
run "test"      backend go test ./...
run "lint"      backend golangci-lint run

echo -e "\n${BOLD}Frontend${RESET}"
run "type check" frontend pnpm exec tsc --noEmit
run "lint"       frontend pnpm lint
run "test"       frontend pnpm test
run "build"      frontend pnpm build

echo ""
if [ ${#failures[@]} -eq 0 ]; then
  echo -e "${PASS} ${BOLD}All checks passed${RESET}"
  exit 0
else
  echo -e "${FAIL} ${BOLD}${#failures[@]} check(s) failed:${RESET}"
  for f in "${failures[@]}"; do
    echo "    - $f"
  done
  exit 1
fi
