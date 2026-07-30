import { homedir } from 'node:os'
import { join } from 'node:path'

export const OPENCLAW_HOME = process.env.OPENCLAW_HOME?.trim() || join(homedir(), '.openclaw')

export const ENV_FILE = process.env.OPENCLAW_ENV_FILE?.trim() || join(OPENCLAW_HOME, '.env')

export const CONFIG_FILE = join(OPENCLAW_HOME, 'openclaw.json')

export const DOCKER_COMPOSE_DIR =
  process.env.OPENCLAW_DOCKER_DIR?.trim() || join(OPENCLAW_HOME, 'docker')

export const DOCKER_COMPOSE = join(DOCKER_COMPOSE_DIR, 'docker-compose.yml')

export const DOCKER_ENV_FILE = join(DOCKER_COMPOSE_DIR, '.env.compose')

export const API_PORT = Number(process.env.API_PORT || 8787)

export const APP_VERSION = '1.2.0'

export const GATEWAY_PORT = Number(process.env.OPENCLAW_GATEWAY_PORT || 18789)

export const GATEWAY_BASE_URL = `http://127.0.0.1:${GATEWAY_PORT}/`

/** Token-authenticated Control UI URL (avoids manual WebSocket token entry). */
export function buildDashboardUrl(token?: string | null): string {
  if (!token?.trim()) return GATEWAY_BASE_URL
  return `${GATEWAY_BASE_URL}#token=${encodeURIComponent(token.trim())}`
}

export const DEFAULT_GATEWAY_MODE = (process.env.OPENCLAW_GATEWAY_MODE || 'auto') as
  | 'auto'
  | 'native'
  | 'docker'

export const BOOTSTRAP_GATEWAY = process.env.OPENCLAW_BOOTSTRAP_GATEWAY === '1'

export const MODEL_PRESETS = [
  { id: 'openai/gpt-5.5', label: 'GPT-5.5 Codex', tier: 'cloud' },
  { id: 'openai/gpt-5.3-codex', label: 'GPT-5.3 Codex', tier: 'cloud' },
  { id: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6', tier: 'cloud' },
  { id: 'claude-cli/claude-sonnet-4-6', label: 'Claude Sonnet 4.6', tier: 'cloud' },
  { id: 'ollama/qwen2.5-coder:14b', label: 'Qwen 2.5 Coder 14B', tier: 'local' },
  { id: 'ollama/qwen3:8b', label: 'Qwen 3 8B', tier: 'local' },
  { id: 'ollama/gpt-oss:20b', label: 'GPT-OSS 20B', tier: 'local' },
  { id: 'ollama/gemma4:latest', label: 'Gemma 4 (local)', tier: 'local' },
  { id: 'ollama/gemma4:31b-cloud', label: 'Gemma 4 31B Cloud', tier: 'cloud' },
  { id: 'ollama/kimi-k2.5:cloud', label: 'Kimi K2.5 Cloud', tier: 'cloud' },
] as const

export const KEY_FIELDS = [
  { env: 'OPENAI_API_KEY', label: 'OpenAI' },
  { env: 'ANTHROPIC_API_KEY', label: 'Anthropic' },
  { env: 'OLLAMA_API_KEY', label: 'Ollama' },
  { env: 'MOONSHOT_API_KEY', label: 'Moonshot' },
  { env: 'OPENROUTER_API_KEY', label: 'OpenRouter' },
  { env: 'GEMINI_API_KEY', label: 'Gemini' },
  { env: 'TELEGRAM_BOT_TOKEN', label: 'Telegram' },
] as const
