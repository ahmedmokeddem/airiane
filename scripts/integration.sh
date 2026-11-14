#!/usr/bin/env bash
# Real HTTP + migrated disposable PostgreSQL; provider invocation remains simulated.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a migrated disposable PostgreSQL database}"
if [[ "$TEST_DATABASE_URL" != postgresql+asyncpg://* ]]; then
  echo "Integration requires PostgreSQL with asyncpg." >&2
  exit 1
fi
integration_log=$(mktemp)
RE_DATABASE_URL="$TEST_DATABASE_URL" RE_DEMO_AUTH=true RE_ENVIRONMENT=development \
  uv run --directory backend uvicorn app.main:app --host 127.0.0.1 --port 8765 >"$integration_log" 2>&1 &
backend_pid=$!
trap 'kill "$backend_pid" 2>/dev/null || true; rm -f "$integration_log"' EXIT
ready=false
for attempt in {1..50}; do
  if curl --fail --silent http://127.0.0.1:8765/health >/dev/null; then ready=true; break; fi
  if ! kill -0 "$backend_pid" 2>/dev/null; then cat "$integration_log"; exit 1; fi
  sleep 1
done
if [[ "$ready" != true ]]; then cat "$integration_log"; exit 1; fi
EXPO_PUBLIC_API_MODE=live EXPO_PUBLIC_API_URL=http://127.0.0.1:8765 \
  npm --prefix mobile run test:integration
