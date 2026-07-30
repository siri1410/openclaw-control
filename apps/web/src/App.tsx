import { useCallback, useEffect, useState } from 'react'
import { api, type StatusResponse } from './api'

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`badge ${ok ? 'ok' : 'off'}`}>{label}</span>
}

export function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null)

  const showToast = (message: string, error = false) => {
    setToast({ message, error })
    setTimeout(() => setToast(null), 4000)
  }

  const refresh = useCallback(async () => {
    try {
      const data = await api.status()
      setStatus(data)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load status', true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15_000)
    return () => clearInterval(id)
  }, [refresh])

  const runAction = async (key: string, fn: () => Promise<unknown>, successMsg: string) => {
    setBusy(key)
    try {
      await fn()
      showToast(successMsg)
      await refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Action failed', true)
    } finally {
      setBusy(null)
    }
  }

  if (loading && !status) {
    return (
      <div className='loading'>
        <div className='spinner' />
        Loading OpenClaw Control…
      </div>
    )
  }

  const gatewayHealthy = status?.gateway.healthy ?? false

  return (
    <div className='app-shell'>
      <header className='hero'>
        <div>
          <h1>
            Open<span>Claw</span> Control
          </h1>
          <p>Local dashboard for gateway, Docker, models, and keys — wraps your OpenClaw CLI.</p>
        </div>
        <div className='actions'>
          <button
            type='button'
            className='btn btn-ghost'
            disabled={!!busy}
            onClick={() => refresh()}
          >
            Refresh
          </button>
          {status?.gateway.url && (
            <a className='link-btn' href={status.gateway.url} target='_blank' rel='noreferrer'>
              Open Gateway UI ↗
            </a>
          )}
        </div>
      </header>

      <div className='grid'>
        <section className='card'>
          <h2>Gateway</h2>
          <div className='stat-row'>
            <span className='stat-label'>Health</span>
            <Badge ok={gatewayHealthy} label={gatewayHealthy ? 'Healthy' : 'Offline'} />
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Port</span>
            <span className='stat-value'>{status?.gatewayPort ?? '—'}</span>
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Docker</span>
            <Badge
              ok={!!status?.gateway.dockerRunning}
              label={status?.gateway.dockerRunning ? 'Running' : 'Stopped'}
            />
          </div>
          <div className='stat-row'>
            <span className='stat-label'>Version</span>
            <span className='stat-value'>{status?.version ?? '—'}</span>
          </div>
          <div className='actions'>
            <button
              type='button'
              className='btn btn-primary'
              disabled={!!busy}
              onClick={() => runAction('native-start', api.startNative, 'Native gateway started')}
            >
              {busy === 'native-start' ? 'Starting…' : 'Start Native'}
            </button>
            <button
              type='button'
              className='btn btn-secondary'
              disabled={!!busy}
              onClick={() => runAction('docker-start', api.startDocker, 'Docker gateway started')}
            >
              {busy === 'docker-start' ? 'Starting…' : 'Start Docker'}
            </button>
            <button
              type='button'
              className='btn btn-danger'
              disabled={!!busy}
              onClick={() => runAction('stop', api.stopNative, 'Native gateway stopped')}
            >
              Stop Native
            </button>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={!!busy}
              onClick={() => runAction('docker-stop', api.stopDocker, 'Docker gateway stopped')}
            >
              Stop Docker
            </button>
          </div>
        </section>

        <section className='card'>
          <h2>Gateway Token</h2>
          <div className='stat-row'>
            <span className='stat-label'>Token</span>
            <span className='stat-value'>{status?.token?.masked ?? 'Not set'}</span>
          </div>
          <div className='actions'>
            <button
              type='button'
              className='btn btn-secondary'
              disabled={!!busy}
              onClick={() =>
                runAction('token-gen', api.generateToken, 'New gateway token generated')
              }
            >
              Generate
            </button>
            <button
              type='button'
              className='btn btn-ghost'
              disabled={!!busy}
              onClick={async () => {
                setBusy('token-copy')
                try {
                  const { token } = await api.revealToken()
                  await navigator.clipboard.writeText(token)
                  showToast('Token copied to clipboard')
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'Copy failed', true)
                } finally {
                  setBusy(null)
                }
              }}
            >
              Copy full token
            </button>
          </div>
          <p style={{ margin: '1rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Paste into the OpenClaw Control UI at Settings when connecting locally.
          </p>
        </section>

        <section className='card'>
          <h2>API Keys</h2>
          <div className='keys-grid'>
            {status?.keys.map((key) => (
              <div key={key.env} className={`key-pill ${key.set ? 'set' : 'unset'}`}>
                <span>{key.label}</span>
                <span>{key.set ? '✓' : '—'}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: '1rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Edit <code>{status?.envFile}</code> or use the shell launcher to apply keys via{' '}
            <code>openclaw onboard</code>.
          </p>
        </section>
      </div>

      <section className='card'>
        <h2>Model Selection</h2>
        <p style={{ margin: '0 0 1rem', color: 'var(--muted)', fontSize: '0.92rem' }}>
          Current: <span className='stat-value'>{status?.primaryModel ?? 'Not set'}</span>
        </p>
        <div className='model-grid'>
          {status?.presets.map((preset) => (
            <button
              key={preset.id}
              type='button'
              className={`model-option ${status.primaryModel === preset.id ? 'active' : ''}`}
              disabled={!!busy}
              onClick={() =>
                runAction(
                  `model-${preset.id}`,
                  () => api.setModel(preset.id, preset.tier === 'local'),
                  `Model set to ${preset.label}`
                )
              }
            >
              <span>
                <strong>{preset.label}</strong>
                <br />
                <small>{preset.id}</small>
              </span>
              <span className={`badge ${preset.tier === 'cloud' ? 'warn' : 'ok'}`}>
                {preset.tier}
              </span>
            </button>
          ))}
        </div>
      </section>

      {toast && <div className={`toast ${toast.error ? 'error' : ''}`}>{toast.message}</div>}
    </div>
  )
}
