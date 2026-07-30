import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { DOCKER_COMPOSE, DOCKER_COMPOSE_DIR, GATEWAY_PORT } from './config'
import { resolveOpenclawEnv } from './docker'

export type CommandResult = {
  ok: boolean
  code: number | null
  stdout: string
  stderr: string
}

export function runCommand(
  command: string,
  args: string[],
  timeoutMs = 120_000,
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ ok: false, code: null, stdout: '', stderr: err.message })
    })
  })
}

export async function runOpenclaw(args: string[], timeoutMs = 120_000): Promise<CommandResult> {
  return runCommand('openclaw', args, timeoutMs, { env: resolveOpenclawEnv() })
}

export async function gatewayHealth(): Promise<{ healthy: boolean; url: string }> {
  const url = `http://127.0.0.1:${GATEWAY_PORT}/healthz`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return { healthy: res.ok, url: `http://127.0.0.1:${GATEWAY_PORT}/` }
  } catch {
    return { healthy: false, url: `http://127.0.0.1:${GATEWAY_PORT}/` }
  }
}

export async function getGatewayStatus(): Promise<string> {
  const result = await runOpenclaw(['gateway', 'status'], 15_000)
  return result.stdout || result.stderr || 'Gateway status unavailable'
}

export async function startNativeGateway(): Promise<CommandResult> {
  await runOpenclaw(['doctor', '--repair'], 60_000)
  await runOpenclaw(['gateway', 'install', '--force'], 30_000)
  return runOpenclaw(['gateway', 'start'], 30_000)
}

export async function stopNativeGateway(): Promise<CommandResult> {
  return runOpenclaw(['gateway', 'stop'], 30_000)
}

export async function setPrimaryModel(modelId: string): Promise<CommandResult> {
  return runOpenclaw(['models', 'set', modelId], 30_000)
}

export async function listOllamaModels(): Promise<string[]> {
  const result = await runCommand('ollama', ['list'], 10_000)
  if (!result.ok) return []
  return result.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.split(/\s+/)[0]?.trim())
    .filter(Boolean) as string[]
}

export async function pullOllamaModel(tag: string): Promise<CommandResult> {
  return runCommand('ollama', ['pull', tag], 600_000)
}

export async function dockerGatewayRunning(): Promise<boolean> {
  const result = await runCommand('docker', ['ps', '--format', '{{.Names}}'], 10_000)
  return result.stdout.split('\n').some((name) => name.includes('openclaw-gateway'))
}

export async function openclawVersion(): Promise<string | null> {
  const result = await runOpenclaw(['--version'], 10_000)
  return result.stdout.split('\n')[0]?.trim() || null
}

export type OpenClawUpdateStatus = {
  currentVersion: string | null
  latestVersion: string | null
  updateAvailable: boolean
  channel: string | null
  installKind: string | null
  raw?: unknown
}

export async function getOpenClawUpdateStatus(): Promise<OpenClawUpdateStatus> {
  const result = await runOpenclaw(['update', 'status', '--json'], 30_000)
  const currentVersion = (await openclawVersion()) || null

  if (!result.ok) {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      channel: null,
      installKind: null,
    }
  }

  try {
    const data = JSON.parse(result.stdout) as {
      update?: { installKind?: string; registry?: { latestVersion?: string } }
      channel?: { label?: string; value?: string }
      availability?: { available?: boolean; latestVersion?: string | null }
    }
    const latestVersion =
      data.availability?.latestVersion || data.update?.registry?.latestVersion || null
    return {
      currentVersion,
      latestVersion,
      updateAvailable: Boolean(data.availability?.available),
      channel: data.channel?.label || data.channel?.value || null,
      installKind: data.update?.installKind || null,
      raw: data,
    }
  } catch {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      channel: null,
      installKind: null,
    }
  }
}

export async function updateOpenClaw(options: { restart?: boolean } = {}): Promise<CommandResult> {
  const args = ['update', '--yes', '--json']
  if (options.restart === false) args.push('--no-restart')
  return runOpenclaw(args, 1_800_000)
}

export async function repairOpenClawUpdate(): Promise<CommandResult> {
  return runOpenclaw(['update', 'repair'], 120_000)
}

export async function copyAuthenticatedDashboardUrl(): Promise<CommandResult> {
  return runOpenclaw(['dashboard', '--no-open'], 15_000)
}

export function composeFileExists(): boolean {
  return existsSync(DOCKER_COMPOSE)
}

export { DOCKER_COMPOSE_DIR }
