import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  API_PORT,
  BOOTSTRAP_GATEWAY,
  buildDashboardUrl,
  DEFAULT_GATEWAY_MODE,
  DOCKER_COMPOSE,
  ENV_FILE,
  GATEWAY_PORT,
  MODEL_PRESETS,
  OPENCLAW_HOME,
} from './config'
import { getDockerLogs, getDockerStatus, stopDockerGateway } from './docker'
import {
  ensureGatewayToken,
  generateToken,
  keyStatus,
  maskToken,
  mergeEnvFile,
  persistGatewayToken,
  readPrimaryModel,
  resolveGatewayToken,
} from './env'
import {
  detectRuntime,
  ensureGateway,
  type GatewayMode,
  repairOpenclaw,
  stopAllGateways,
} from './gateway'
import {
  gatewayHealth,
  getGatewayStatus,
  listOllamaModels,
  openclawVersion,
  pullOllamaModel,
  setPrimaryModel,
  stopNativeGateway,
} from './openclaw'

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  })
)

app.get('/api/health', (c) =>
  c.json({ ok: true, service: 'openclaw-control-api', version: '1.1.0' })
)

app.get('/api/status', async (c) => {
  const [health, docker, version, ollamaModels, runtime] = await Promise.all([
    gatewayHealth(),
    getDockerStatus(),
    openclawVersion(),
    listOllamaModels(),
    detectRuntime(),
  ])

  const token = ensureGatewayToken()

  return c.json({
    openclawHome: OPENCLAW_HOME,
    envFile: ENV_FILE,
    dockerCompose: DOCKER_COMPOSE,
    gatewayPort: GATEWAY_PORT,
    apiPort: API_PORT,
    version,
    runtime,
    docker,
    gateway: {
      ...health,
      dockerRunning: docker.gatewayContainer,
      statusText: await getGatewayStatus(),
      dashboardUrl: buildDashboardUrl(token),
    },
    dashboardUrl: buildDashboardUrl(token),
    token: { masked: maskToken(token), length: token.length },
    primaryModel: readPrimaryModel(),
    keys: keyStatus(),
    ollamaModels,
    presets: MODEL_PRESETS,
    defaultMode: DEFAULT_GATEWAY_MODE,
  })
})

app.get('/api/docker/status', async (c) => c.json(await getDockerStatus()))

app.get('/api/docker/logs', async (c) => {
  const tail = Number(c.req.query('tail') || 80)
  return c.json({ logs: await getDockerLogs(tail) })
})

app.post('/api/gateway/ensure', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { mode?: GatewayMode }
  const mode = body.mode || DEFAULT_GATEWAY_MODE
  const result = await ensureGateway(mode)
  return c.json(result, result.ok ? 200 : 502)
})

app.post('/api/gateway/repair', async (c) => {
  const output = await repairOpenclaw()
  const result = await ensureGateway('auto')
  return c.json({ output, gateway: result })
})

app.get('/api/models/presets', (c) => c.json({ presets: MODEL_PRESETS }))

app.post('/api/models/set', async (c) => {
  const body = (await c.req.json()) as { modelId?: string; pull?: boolean }
  const modelId = body.modelId?.trim()
  if (!modelId) return c.json({ error: 'modelId required' }, 400)

  if (body.pull && modelId.startsWith('ollama/')) {
    const tag = modelId.replace(/^ollama\//, '')
    const pull = await pullOllamaModel(tag)
    if (!pull.ok) {
      return c.json({ error: pull.stderr || 'Ollama pull failed', pull }, 502)
    }
  }

  const result = await setPrimaryModel(modelId)
  mergeEnvFile({ OPENCLAW_PRIMARY_MODEL: modelId })

  if (!result.ok) {
    return c.json({ error: result.stderr || 'Failed to set model', result }, 502)
  }

  return c.json({ ok: true, modelId, output: result.stdout })
})

app.get('/api/dashboard-url', (c) => {
  const token = ensureGatewayToken()
  const url = buildDashboardUrl(token)
  return c.json({ url, token: maskToken(token), gatewayPort: GATEWAY_PORT })
})

app.get('/api/token', (c) => {
  const token = resolveGatewayToken()
  if (!token) return c.json({ token: null })
  return c.json({ token: maskToken(token), length: token.length })
})

app.post('/api/token', async (c) => {
  const body = (await c.req.json()) as { action?: string; token?: string }
  const action = body.action || 'generate'

  if (action === 'generate') {
    const token = generateToken()
    persistGatewayToken(token)
    return c.json({ ok: true, token: maskToken(token), length: token.length })
  }

  if (action === 'set') {
    const token = body.token?.trim()
    if (!token) return c.json({ error: 'token required' }, 400)
    persistGatewayToken(token)
    return c.json({ ok: true, token: maskToken(token), length: token.length })
  }

  return c.json({ error: 'Unknown action' }, 400)
})

app.post('/api/token/reveal', (c) => {
  const token = resolveGatewayToken()
  if (!token) return c.json({ error: 'No token configured' }, 404)
  return c.json({ token })
})

app.get('/api/keys', (c) => c.json({ keys: keyStatus() }))

app.put('/api/keys', async (c) => {
  const body = (await c.req.json()) as Record<string, string>
  const allowed = new Set([
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'OLLAMA_API_KEY',
    'MOONSHOT_API_KEY',
    'OPENROUTER_API_KEY',
    'GEMINI_API_KEY',
    'TELEGRAM_BOT_TOKEN',
    'OPENCLAW_GATEWAY_TOKEN',
    'OPENCLAW_PRIMARY_MODEL',
  ])

  const updates: Record<string, string> = {}
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key) && typeof value === 'string') updates[key] = value
  }

  mergeEnvFile(updates)
  if (updates.OPENCLAW_GATEWAY_TOKEN) persistGatewayToken(updates.OPENCLAW_GATEWAY_TOKEN)

  return c.json({ ok: true, keys: keyStatus(), saved: Object.keys(updates) })
})

app.post('/api/gateway/native/start', async (c) => {
  const result = await ensureGateway('native')
  return c.json(result, result.ok ? 200 : 502)
})

app.post('/api/gateway/native/stop', async (c) => {
  const result = await stopNativeGateway()
  return c.json({ ok: result.ok, output: result.stdout, error: result.stderr || null })
})

app.post('/api/gateway/docker/start', async (c) => {
  const result = await ensureGateway('docker')
  return c.json(result, result.ok ? 200 : 502)
})

app.post('/api/gateway/docker/stop', async (c) => {
  const result = await stopDockerGateway()
  return c.json({ ok: result.ok, output: result.stdout, error: result.stderr || null })
})

app.post('/api/gateway/stop-all', async (c) => {
  const result = await stopAllGateways()
  return c.json({ ok: true, ...result })
})

const port = API_PORT

console.log(`OpenClaw Control API v1.2 → http://127.0.0.1:${port}`)

ensureGatewayToken()

if (BOOTSTRAP_GATEWAY) {
  console.log(`Bootstrapping gateway (mode=${DEFAULT_GATEWAY_MODE})…`)
  ensureGateway(DEFAULT_GATEWAY_MODE).then((r) => {
    console.log(`Gateway bootstrap: ${r.message} (healthy=${r.healthy}, runtime=${r.runtime})`)
    if (r.healthy) {
      console.log(`Authenticated dashboard → ${r.dashboardUrl}`)
    }
  })
}

try {
  Bun.serve({ fetch: app.fetch, port })
} catch (err) {
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
  if (code === 'EADDRINUSE') {
    console.error(
      `Port ${port} already in use. Stop the other API instance:\n  lsof -ti :${port} | xargs kill\nOr use the running API at http://127.0.0.1:${port}`
    )
    process.exit(1)
  }
  throw err
}

export { app }
