# OpenClaw Control

Full-stack local dashboard for [OpenClaw](https://openclaw.ai) — gateway management, Docker, model selection, and API key status.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Bun + Hono (`apps/api`) |
| Frontend | React 19 + Vite (`apps/web`) |
| Runtime | OpenClaw CLI + optional Docker |

## Prerequisites

- [Bun](https://bun.sh) 1.1+
- [OpenClaw](https://docs.openclaw.ai/install/) installed (`openclaw` on PATH)
- Optional: Docker Desktop (for containerized gateway)
- Optional: Ollama (for local models)

## Quick start

```bash
# Clone and install
git clone https://github.com/siri1410/openclaw-control.git
cd openclaw-control
bun install

# Copy env template (optional overrides)
cp .env.example .env

# Run API + web (two terminals)
bun run dev:api   # http://127.0.0.1:8787
bun run dev:web   # http://127.0.0.1:5173
```

Open **http://127.0.0.1:5173** for the control panel.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `8787` | Backend port |
| `OPENCLAW_HOME` | `~/.openclaw` | OpenClaw state directory |
| `OPENCLAW_ENV_FILE` | `~/.openclaw/.env` | Keys file |
| `OPENCLAW_GATEWAY_PORT` | `18789` | Gateway port |
| `WEB_PORT` | `5173` | Vite dev server port |

## API endpoints

- `GET /api/status` — gateway health, models, keys
- `POST /api/gateway/native/start|stop` — LaunchAgent/systemd gateway
- `POST /api/gateway/docker/start|stop` — Docker Compose gateway
- `POST /api/models/set` — set primary model (`{ modelId, pull? }`)
- `POST /api/token` — generate gateway token
- `PUT /api/keys` — update `.env` keys

## Related

Shell launcher (companion): `~/.openclaw/scripts/openclaw-launcher.sh`

```bash
~/.openclaw/scripts/openclaw-launcher.sh start
```

## License

MIT
