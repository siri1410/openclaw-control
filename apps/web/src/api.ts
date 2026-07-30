export const API_BASE = import.meta.env.VITE_API_URL || ''

export type DockerStatus = {
  installed: boolean
  running: boolean
  gatewayContainer: boolean
  image: string
  composeFile: string
}

export type GatewayRuntime = 'native' | 'docker' | 'none'

export type StatusResponse = {
  openclawHome: string
  envFile: string
  gatewayPort: number
  version: string | null
  runtime: GatewayRuntime
  docker: DockerStatus
  defaultMode: string
  gateway: {
    healthy: boolean
    url: string
    dashboardUrl?: string
    dockerRunning: boolean
    statusText: string
  }
  dashboardUrl: string
  token: { masked: string; length: number }
  primaryModel: string | null
  keys: Array<{ env: string; label: string; set: boolean }>
  ollamaModels: string[]
  presets: Array<{ id: string; label: string; tier: string }>
}

export type EnsureGatewayResponse = {
  ok: boolean
  mode: string
  runtime: GatewayRuntime
  healthy: boolean
  url: string
  dashboardUrl: string
  message: string
  error?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || data.message || res.statusText)
  return data as T
}

export const api = {
  status: () => request<StatusResponse>('/api/status'),
  setModel: (modelId: string, pull = false) =>
    request<{ ok: boolean; modelId: string }>('/api/models/set', {
      method: 'POST',
      body: JSON.stringify({ modelId, pull }),
    }),
  generateToken: () =>
    request<{ ok: boolean; token: string }>('/api/token', {
      method: 'POST',
      body: JSON.stringify({ action: 'generate' }),
    }),
  revealToken: () => request<{ token: string }>('/api/token/reveal', { method: 'POST' }),
  dashboardUrl: () => request<{ url: string }>('/api/dashboard-url'),
  ensureGateway: (mode: 'auto' | 'native' | 'docker' = 'auto') =>
    request<EnsureGatewayResponse>('/api/gateway/ensure', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),
  repair: () =>
    request<{ output: string; gateway: EnsureGatewayResponse }>('/api/gateway/repair', {
      method: 'POST',
    }),
  startNative: () =>
    request<EnsureGatewayResponse>('/api/gateway/native/start', { method: 'POST' }),
  stopNative: () => request('/api/gateway/native/stop', { method: 'POST' }),
  startDocker: () =>
    request<EnsureGatewayResponse>('/api/gateway/docker/start', { method: 'POST' }),
  stopDocker: () => request('/api/gateway/docker/stop', { method: 'POST' }),
  stopAll: () => request('/api/gateway/stop-all', { method: 'POST' }),
  dockerLogs: (tail = 80) => request<{ logs: string }>(`/api/docker/logs?tail=${tail}`),
}
