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
  if output=$("$@" 2>&1); then
    echo -e "$PASS"
  else
    echo -e "$FAIL"
    failures+=("$label")
    echo "$output" | sed 's/^/    /'
  fi
}

run_exec() {
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
run_exec "build"     backend go build ./...
run_exec "test"      backend go test ./...
run_exec "lint"      backend golangci-lint run

echo -e "\n${BOLD}Frontend${RESET}"
run_exec "type check" frontend pnpm exec tsc --noEmit
run_exec "lint"       frontend pnpm lint
run_exec "test"       frontend pnpm test
run_exec "build"      frontend pnpm build

echo -e "\n${BOLD}Docker${RESET}"
run "image build" docker compose build

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
