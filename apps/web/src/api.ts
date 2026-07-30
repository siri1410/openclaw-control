export const API_BASE = import.meta.env.VITE_API_URL || ''

export type StatusResponse = {
  openclawHome: string
  envFile: string
  gatewayPort: number
  version: string | null
  gateway: {
    healthy: boolean
    url: string
    dockerRunning: boolean
    statusText: string
  }
  token: { masked: string; length: number } | null
  primaryModel: string | null
  keys: Array<{ env: string; label: string; set: boolean }>
  ollamaModels: string[]
  presets: Array<{ id: string; label: string; tier: string }>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || res.statusText)
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
  startNative: () => request('/api/gateway/native/start', { method: 'POST' }),
  stopNative: () => request('/api/gateway/native/stop', { method: 'POST' }),
  startDocker: () => request('/api/gateway/docker/start', { method: 'POST' }),
  stopDocker: () => request('/api/gateway/docker/stop', { method: 'POST' }),
}
