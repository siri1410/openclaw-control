# OpenClaw Control

Production-grade local dashboard for [OpenClaw](https://openclaw.ai) — smart gateway orchestration, Docker auto-start, models, and keys.

## Features

- **Smart Start (Auto)** — tries native gateway first, falls back to Docker
- **Docker orchestration** — opens Docker Desktop on macOS, waits for daemon, pulls image, starts container
- **Health polling** — waits up to 90s for `/healthz` before reporting success
- **Bootstrap on launch** — `OPENCLAW_BOOTSTRAP_GATEWAY=1` starts gateway when API boots
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

# One command — API + web + auto gateway bootstrap
bun run dev
```

Open **http://localhost:5173** → click **Smart Start (Auto)**.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `8787` | Backend port |
| `OPENCLAW_HOME` | `~/.openclaw` | OpenClaw state directory |
| `OPENCLAW_GATEWAY_MODE` | `auto` | `auto` \| `native` \| `docker` |
| `OPENCLAW_BOOTSTRAP_GATEWAY` | `1` in dev script | Start gateway on API boot |
| `OPENCLAW_IMAGE` | `ghcr.io/openclaw/openclaw:latest` | Docker image |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Full system status |
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
