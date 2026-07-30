#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting OpenClaw Control API on :8787"
bun run --cwd apps/api dev &
API_PID=$!

sleep 1

echo "Starting OpenClaw Control Web on :5173"
bun run --cwd apps/web dev &
WEB_PID=$!

echo ""
echo "  Dashboard → http://127.0.0.1:5173"
echo "  API       → http://127.0.0.1:8787"
echo ""

wait
