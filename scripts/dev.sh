#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_PORT="${API_PORT:-8787}"
WEB_PORT="${WEB_PORT:-5173}"
AUTO_OPEN="${OPENCLAW_AUTO_OPEN:-1}"

# Prefer Node 24.15+ for OpenClaw CLI compatibility
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 24.15.0 2>/dev/null || fnm use 24 2>/dev/null || true
fi

export OPENCLAW_BOOTSTRAP_GATEWAY="${OPENCLAW_BOOTSTRAP_GATEWAY:-1}"
export OPENCLAW_GATEWAY_MODE="${OPENCLAW_GATEWAY_MODE:-auto}"

api_healthy() {
  curl -sf "http://127.0.0.1:${API_PORT}/api/health" >/dev/null 2>&1
}

wait_for_api() {
  local tries=0
  while [[ $tries -lt 30 ]]; do
    if api_healthy; then
      return 0
    fi
    tries=$((tries + 1))
    sleep 1
  done
  return 1
}

open_url() {
  local url="$1"
  if [[ "$AUTO_OPEN" != "1" ]]; then
    return 0
  fi
  if command -v open >/dev/null 2>&1; then
    open "$url" 2>/dev/null || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" 2>/dev/null || true
  fi
}

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OpenClaw Control — mature local stack"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Bootstrap gateway : ${OPENCLAW_BOOTSTRAP_GATEWAY} (mode=${OPENCLAW_GATEWAY_MODE})"
echo "  Node              : $(node -v 2>/dev/null || echo unknown)"
echo ""

API_PID=""
if api_healthy; then
  echo "API already running on :${API_PORT} — reusing"
else
  if lsof -nP -iTCP:"${API_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port ${API_PORT} is in use but API is not healthy."
    echo "Free it with: lsof -ti :${API_PORT} | xargs kill"
    exit 1
  fi

  echo "Starting API on :${API_PORT}"
  bun run --cwd apps/api dev &
  API_PID=$!

  if ! wait_for_api; then
    echo "API failed to start on :${API_PORT}"
    exit 1
  fi
fi

echo "Starting Web on :${WEB_PORT}"
bun run --cwd apps/web dev &
WEB_PID=$!

sleep 2

DASHBOARD_URL="$(curl -sf "http://127.0.0.1:${API_PORT}/api/dashboard-url" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || true)"
UPDATE_NOTE="$(curl -sf "http://127.0.0.1:${API_PORT}/api/openclaw/update-status" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"update available: {d.get('latestVersion')}\" if d.get('updateAvailable') else 'OpenClaw up to date')" 2>/dev/null || true)"

echo ""
echo "  Control UI  → http://localhost:${WEB_PORT}"
echo "  API         → http://127.0.0.1:${API_PORT}"
if [[ -n "$DASHBOARD_URL" ]]; then
  echo "  Gateway UI  → ${DASHBOARD_URL}"
fi
if [[ -n "$UPDATE_NOTE" ]]; then
  echo "  OpenClaw    → ${UPDATE_NOTE}"
fi
echo ""

open_url "http://localhost:${WEB_PORT}"
if [[ -n "$DASHBOARD_URL" ]]; then
  sleep 1
  open_url "$DASHBOARD_URL"
fi

wait
