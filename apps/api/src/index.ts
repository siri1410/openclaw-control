import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  API_PORT,
  DOCKER_COMPOSE,
  ENV_FILE,
  GATEWAY_PORT,
  MODEL_PRESETS,
  OPENCLAW_HOME,
} from './config'
import {
  generateToken,
  keyStatus,
  maskToken,
  mergeEnvFile,
  persistGatewayToken,
  readPrimaryModel,
  resolveGatewayToken,
} from './env'
import {
  dockerCompose,
  dockerGatewayRunning,
  gatewayHealth,
  getGatewayStatus,
  listOllamaModels,
  openclawVersion,
  pullOllamaModel,
  setPrimaryModel,
  startNativeGateway,
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

app.get('/api/health', (c) => c.json({ ok: true, service: 'openclaw-control-api' }))

app.get('/api/status', async (c) => {
  const [health, dockerRunning, version, ollamaModels] = await Promise.all([
    gatewayHealth(),
    dockerGatewayRunning(),
    openclawVersion(),
    listOllamaModels(),
  ])

  const token = resolveGatewayToken()

  return c.json({
    openclawHome: OPENCLAW_HOME,
    envFile: ENV_FILE,
    dockerCompose: DOCKER_COMPOSE,
    gatewayPort: GATEWAY_PORT,
    apiPort: API_PORT,
    version,
    gateway: {
      ...health,
      dockerRunning,
      statusText: await getGatewayStatus(),
    },
    token: token ? { masked: maskToken(token), length: token.length } : null,
    primaryModel: readPrimaryModel(),
    keys: keyStatus(),
    ollamaModels,
    presets: MODEL_PRESETS,
  })
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
    if (allowed.has(key) && typeof value === 'string') {
      updates[key] = value
    }
  }

  const merged = mergeEnvFile(updates)
  if (updates.OPENCLAW_GATEWAY_TOKEN) {
    persistGatewayToken(updates.OPENCLAW_GATEWAY_TOKEN)
  }

  return c.json({ ok: true, keys: keyStatus(), saved: Object.keys(updates) })
})

app.post('/api/gateway/native/start', async (c) => {
  const result = await startNativeGateway()
  const health = await gatewayHealth()
  return c.json({ ok: result.ok, health, output: result.stdout, error: result.stderr || null })
})

app.post('/api/gateway/native/stop', async (c) => {
  const result = await stopNativeGateway()
  return c.json({ ok: result.ok, output: result.stdout, error: result.stderr || null })
})

app.post('/api/gateway/docker/start', async (c) => {
  const token = resolveGatewayToken() || generateToken()
  persistGatewayToken(token)
  await dockerCompose(['pull', 'openclaw-gateway'])
  const result = await dockerCompose(['up', '-d', 'openclaw-gateway'])
  const health = await gatewayHealth()
  return c.json({ ok: result.ok, health, output: result.stdout, error: result.stderr || null })
})

app.post('/api/gateway/docker/stop', async (c) => {
  const result = await dockerCompose(['down'])
  return c.json({ ok: result.ok, output: result.stdout, error: result.stderr || null })
})

const port = API_PORT

console.log(`OpenClaw Control API → http://127.0.0.1:${port}`)

Bun.serve({
  fetch: app.fetch,
  port,
})

export { app }
