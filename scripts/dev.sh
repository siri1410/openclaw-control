#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Prefer Node 24.15+ for OpenClaw CLI compatibility
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 24.15.0 2>/dev/null || fnm use 24 2>/dev/null || true
fi

export OPENCLAW_BOOTSTRAP_GATEWAY="${OPENCLAW_BOOTSTRAP_GATEWAY:-1}"
export OPENCLAW_GATEWAY_MODE="${OPENCLAW_GATEWAY_MODE:-auto}"

cleanup() {
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OpenClaw Control — mature local stack"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Bootstrap gateway : ${OPENCLAW_BOOTSTRAP_GATEWAY} (mode=${OPENCLAW_GATEWAY_MODE})"
echo "  Node              : $(node -v 2>/dev/null || echo unknown)"
echo ""

echo "Starting API on :8787"
bun run --cwd apps/api dev &
API_PID=$!
sleep 2

echo "Starting Web on :5173"
bun run --cwd apps/web dev &
WEB_PID=$!

echo ""
echo "  Dashboard → http://localhost:5173"
echo "  API       → http://127.0.0.1:8787"
echo "  Gateway   → http://127.0.0.1:18789 (auto-started if down)"
echo ""

wait
