import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { CONFIG_FILE, ENV_FILE, KEY_FIELDS } from './config'

export type EnvMap = Record<string, string>

export function readEnvFile(): EnvMap {
  if (!existsSync(ENV_FILE)) return {}
  const map: EnvMap = {}
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    map[key] = value
  }
  return map
}

export function writeEnvFile(map: EnvMap): void {
  const lines = ['# OpenClaw Control — managed keys (do not commit)']
  for (const [key, value] of Object.entries(map)) {
    if (value) lines.push(`${key}=${value}`)
  }
  writeFileSync(ENV_FILE, `${lines.join('\n')}\n`, 'utf8')
}

export function mergeEnvFile(updates: EnvMap): EnvMap {
  const current = readEnvFile()
  const merged = { ...current, ...updates }
  writeEnvFile(merged)
  return merged
}

export function readConfigToken(): string | null {
  if (!existsSync(CONFIG_FILE)) return null
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as {
      gateway?: { auth?: { token?: string } }
    }
    return data.gateway?.auth?.token?.trim() || null
  } catch {
    return null
  }
}

export function resolveGatewayToken(): string | null {
  const fromEnv = process.env.OPENCLAW_GATEWAY_TOKEN?.trim()
  if (fromEnv) return fromEnv
  const fromFile = readEnvFile().OPENCLAW_GATEWAY_TOKEN?.trim()
  if (fromFile) return fromFile
  return readConfigToken()
}

export function generateToken(): string {
  return randomBytes(24).toString('hex')
}

export function persistGatewayToken(token: string): void {
  mergeEnvFile({ OPENCLAW_GATEWAY_TOKEN: token })
  if (!existsSync(CONFIG_FILE)) return
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Record<string, unknown>
    const gateway = (data.gateway as Record<string, unknown>) || {}
    const auth = (gateway.auth as Record<string, unknown>) || {}
    auth.token = token
    auth.mode = 'token'
    gateway.auth = auth
    data.gateway = gateway
    writeFileSync(CONFIG_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  } catch {
    // config sync is best-effort
  }
}

export function readPrimaryModel(): string | null {
  const fromEnv = readEnvFile().OPENCLAW_PRIMARY_MODEL?.trim()
  if (fromEnv) return fromEnv
  if (!existsSync(CONFIG_FILE)) return null
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as {
      agents?: { defaults?: { model?: { primary?: string } } }
    }
    return data.agents?.defaults?.model?.primary?.trim() || null
  } catch {
    return null
  }
}

export function keyStatus(): Array<{ env: string; label: string; set: boolean }> {
  const env = readEnvFile()
  return KEY_FIELDS.map(({ env: key, label }) => ({
    env: key,
    label,
    set: Boolean(env[key]?.trim()),
  }))
}

export function maskToken(token: string): string {
  if (token.length <= 12) return '••••••••'
  return `${token.slice(0, 8)}…${token.slice(-4)}`
}
