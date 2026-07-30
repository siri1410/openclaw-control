import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { DOCKER_COMPOSE, GATEWAY_PORT, OPENCLAW_HOME } from './config'

export type CommandResult = {
  ok: boolean
  code: number | null
  stdout: string
  stderr: string
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
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

    const timer = options.timeoutMs
      ? setTimeout(() => {
          child.kill('SIGTERM')
        }, options.timeoutMs)
      : null

    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      })
    })

    child.on('error', (err) => {
      if (timer) clearTimeout(timer)
      resolve({ ok: false, code: null, stdout: '', stderr: err.message })
    })
  })
}

export async function runOpenclaw(args: string[], timeoutMs = 120_000): Promise<CommandResult> {
  return run('openclaw', args, {
    env: { OPENCLAW_STATE_DIR: OPENCLAW_HOME },
    timeoutMs,
  })
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
  const install = await runOpenclaw(['gateway', 'install'], 30_000)
  if (!install.ok) {
    return runOpenclaw(['gateway', 'start'], 30_000)
  }
  return runOpenclaw(['gateway', 'start'], 30_000)
}

export async function stopNativeGateway(): Promise<CommandResult> {
  return runOpenclaw(['gateway', 'stop'], 30_000)
}

export async function setPrimaryModel(modelId: string): Promise<CommandResult> {
  return runOpenclaw(['models', 'set', modelId], 30_000)
}

export async function listOllamaModels(): Promise<string[]> {
  const result = await run('ollama', ['list'], { timeoutMs: 10_000 })
  if (!result.ok) return []
  return result.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.split(/\s+/)[0]?.trim())
    .filter(Boolean) as string[]
}

export async function pullOllamaModel(tag: string): Promise<CommandResult> {
  return run('ollama', ['pull', tag], 600_000)
}

export async function dockerCompose(args: string[]): Promise<CommandResult> {
  if (!existsSync(DOCKER_COMPOSE)) {
    return { ok: false, code: 1, stdout: '', stderr: 'docker-compose.yml not found' }
  }
  return run(
    'docker',
    ['compose', '-f', DOCKER_COMPOSE, '--project-directory', `${OPENCLAW_HOME}/docker`, ...args],
    { timeoutMs: 120_000 }
  )
}

export async function dockerGatewayRunning(): Promise<boolean> {
  const result = await run('docker', ['ps', '--format', '{{.Names}}'], { timeoutMs: 10_000 })
  return result.stdout.split('\n').some((name) => name.includes('openclaw-gateway'))
}

export async function openclawVersion(): Promise<string | null> {
  const result = await runOpenclaw(['--version'], 10_000)
  return result.stdout.split('\n')[0]?.trim() || null
}
