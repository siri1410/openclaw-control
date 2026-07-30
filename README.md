# OpenClaw Control

Production-grade local dashboard for [OpenClaw](https://openclaw.ai) — smart gateway orchestration, Docker auto-start, models, and keys.

## Features

- **Works out of the box** — auto-syncs gateway token from `~/.openclaw/openclaw.json`, opens authenticated dashboard URL (no manual token paste)
- **Smart Start (Auto)** — tries native gateway first, falls back to Docker, opens token-authenticated Control UI
- **Docker orchestration** — opens Docker Desktop on macOS, waits for daemon, pulls image, starts container
- **Health polling** — waits up to 90s for `/healthz` before reporting success
- **Bootstrap on launch** — `OPENCLAW_BOOTSTRAP_GATEWAY=1` starts gateway when API boots
- **Port-safe dev** — reuses a healthy API on `:8787` instead of crashing with `EADDRINUSE`
- **Node 24.15+ path** — auto-resolves fnm OpenClaw binary for compatible CLI version

## Stack

| Layer | Tech |
|-------|------|
| Backend | Bun + Hono (`apps/api`) |
| Frontend | React 19 + Vite (`apps/web`) |
| Gateway | OpenClaw CLI (native) or Docker (`docker/docker-compose.yml`) |

## Prerequisites

- [Bun](https://bun.sh) 1.1+
- [OpenClaw](https://docs.openclaw.ai/install/) on PATH (Node **24.15+** recommended)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for container mode / auto fallback)
- Optional: [Ollama](https://ollama.com) for local models

## Quick start

```bash
git clone https://github.com/siri1410/openclaw-control.git
cd openclaw-control
bun install
cp .env.example .env

# One command — API + web + auto gateway bootstrap + authenticated dashboard
bun run dev
```

This will:

1. Sync/generate your gateway token in `~/.openclaw/.env` + `openclaw.json`
2. Bootstrap the gateway if it is down
3. Open **http://localhost:5173** (Control dashboard)
4. Open **http://127.0.0.1:18789/#token=…** (native Gateway UI, pre-authenticated)

Set `OPENCLAW_AUTO_OPEN=0` to skip browser auto-open.

### Gateway connection troubleshooting

If the native Control UI shows **"Could not connect"**, you opened the bare URL without a token. Use either:

- **Copy Auth URL** in the Control dashboard, or
- Run `openclaw dashboard --no-open` and paste the clipboard URL

The authenticated URL format is: `http://127.0.0.1:18789/#token=YOUR_TOKEN`

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `8787` | Backend port |
| `OPENCLAW_HOME` | `~/.openclaw` | OpenClaw state directory |
| `OPENCLAW_GATEWAY_MODE` | `auto` | `auto` \| `native` \| `docker` |
| `OPENCLAW_BOOTSTRAP_GATEWAY` | `1` in dev script | Start gateway on API boot |
| `OPENCLAW_AUTO_OPEN` | `1` in dev script | Open Control + Gateway UI in browser |
| `OPENCLAW_IMAGE` | `ghcr.io/openclaw/openclaw:latest` | Docker image |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Full system status (+ `dashboardUrl`) |
| GET | `/api/dashboard-url` | Token-authenticated Gateway UI URL |
| POST | `/api/gateway/ensure` | Smart start `{ mode: "auto"\|"native"\|"docker" }` |
| POST | `/api/gateway/repair` | `openclaw doctor --repair` + auto restart |
| POST | `/api/gateway/docker/start` | Docker only (opens Docker Desktop) |
| GET | `/api/docker/logs` | Container logs |
| POST | `/api/models/set` | Set primary model |

## Shell launcher

Companion script with the same Docker + native logic:

```bash
~/.openclaw/scripts/openclaw-launcher.sh start   # native → docker fallback
~/.openclaw/scripts/openclaw-launcher.sh docker  # force Docker
```

## License

MIT
