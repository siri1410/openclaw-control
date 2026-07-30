import { buildDashboardUrl } from './config'
import {
  ensureDockerDaemon,
  getDockerStatus,
  startDockerGateway,
  stopDockerGateway,
} from './docker'
import { ensureGatewayToken } from './env'
import {
  dockerGatewayRunning,
  gatewayHealth,
  getGatewayStatus,
  runOpenclaw,
  startNativeGateway,
  stopNativeGateway,
} from './openclaw'

export type GatewayMode = 'auto' | 'native' | 'docker'
export type GatewayRuntime = 'native' | 'docker' | 'none'

export type EnsureGatewayResult = {
  ok: boolean
  mode: GatewayMode
  runtime: GatewayRuntime
  healthy: boolean
  url: string
  dashboardUrl: string
  message: string
  error?: string
}

export async function detectRuntime(): Promise<GatewayRuntime> {
  if (await dockerGatewayRunning()) return 'docker'
  const status = await getGatewayStatus()
  if (status.includes('Runtime: running')) return 'native'
  return 'none'
}

export async function ensureGateway(mode: GatewayMode = 'auto'): Promise<EnsureGatewayResult> {
  const token = ensureGatewayToken()
  const dashboardUrl = buildDashboardUrl(token)

  const health = await gatewayHealth()
  if (health.healthy) {
    const runtime = await detectRuntime()
    return {
      ok: true,
      mode,
      runtime,
      healthy: true,
      url: health.url,
      dashboardUrl,
      message: `Gateway already healthy (${runtime})`,
    }
  }

  if (mode === 'docker') {
    return startDocker(mode, token)
  }

  if (mode === 'native') {
    return startNative(mode)
  }

  // auto: native first, docker fallback
  const native = await startNative('auto')
  if (native.ok && native.healthy) return native
  return startDocker('auto', token, `Native failed: ${native.message}`)
}

async function startNative(mode: GatewayMode): Promise<EnsureGatewayResult> {
  const result = await startNativeGateway()
  const health = await waitHealth(45_000)
  const token = ensureGatewayToken()
  return {
    ok: result.ok || health,
    mode,
    runtime: health ? 'native' : 'none',
    healthy: health,
    url: `http://127.0.0.1:${process.env.OPENCLAW_GATEWAY_PORT || 18789}/`,
    dashboardUrl: buildDashboardUrl(token),
    message: health ? 'Native gateway started' : 'Native gateway start attempted',
    error: result.ok ? undefined : result.stderr || undefined,
  }
}

async function startDocker(
  mode: GatewayMode,
  token: string,
  fallbackReason?: string
): Promise<EnsureGatewayResult> {
  const daemon = await ensureDockerDaemon({ openApp: true })
  if (!daemon.ok) {
    const failToken = ensureGatewayToken()
    return {
      ok: false,
      mode,
      runtime: 'none',
      healthy: false,
      url: `http://127.0.0.1:${process.env.OPENCLAW_GATEWAY_PORT || 18789}/`,
      dashboardUrl: buildDashboardUrl(failToken),
      message: 'Docker unavailable',
      error: daemon.stderr,
    }
  }

  const result = await startDockerGateway(token)
  return {
    ok: result.ok && Boolean(result.health),
    mode,
    runtime: result.health ? 'docker' : 'none',
    healthy: Boolean(result.health),
    url: `http://127.0.0.1:${process.env.OPENCLAW_GATEWAY_PORT || 18789}/`,
    dashboardUrl: buildDashboardUrl(token),
    message: result.health
      ? fallbackReason
        ? `Docker gateway started (fallback: ${fallbackReason})`
        : 'Docker gateway started'
      : 'Docker container started but health check failed',
    error: result.ok ? undefined : result.stderr || undefined,
  }
}

async function waitHealth(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const h = await gatewayHealth()
    if (h.healthy) return true
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

export async function stopAllGateways(): Promise<{ native: boolean; docker: boolean }> {
  const [native, docker] = await Promise.all([stopNativeGateway(), stopDockerGateway()])
  return { native: native.ok, docker: docker.ok }
}

export async function repairOpenclaw(): Promise<string> {
  const result = await runOpenclaw(['doctor', '--repair'], 90_000)
  return result.stdout || result.stderr || 'Repair complete'
}

export async function getFullStatus() {
  const [health, docker, runtime] = await Promise.all([
    gatewayHealth(),
    getDockerStatus(),
    detectRuntime(),
  ])
  return { health, docker, runtime }
}
